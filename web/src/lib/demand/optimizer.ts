import type { CityCode } from "@/lib/cities";
import { prisma } from "@/lib/db";
import {
  CAPACITY_THRESHOLD,
  TRIP_WEIGHT,
  loadDemandContext,
  type DemandContext,
} from "@/lib/demand/aggregate";
import { predictDemandIndex } from "@/lib/demand/demand-model";
import { recommendDeparture } from "@/lib/demand/recommend";
import { formatSlotLabel, roundToSlot, toMinutes } from "@/lib/demand/time-slots";

/**
 * CITY-WIDE RE-OPTIMISATION — the part that stops CityFlow AI from simply
 * relocating a traffic jam.
 *
 * THE PROBLEM IT SOLVES
 * A recommendation engine that looks at one person at a time will tell every
 * one of them that 8:45 is the quiet slot. Follow that advice at scale and
 * 8:45 becomes the new 9:00. Moving a peak is not reducing a peak.
 *
 * HOW IT IS AVOIDED
 * Recommendations are recalculated for the whole city IN SEQUENCE, and each
 * person's recommended slot is provisionally added to the demand curve before
 * the next person is considered. So the fifth person to be processed sees the
 * pressure the first four have already put on 8:45, and is offered 8:30 or 9:15
 * instead. The result is a spread, not a stack.
 *
 * WHAT IT WILL NOT DO
 *  - It never moves someone who has already COMMITTED to a time. Once a person
 *    has accepted a recommendation or confirmed a plan through the assistant,
 *    they are treated as fixed. Their slot is counted as load for everybody
 *    else; they are not shuffled around for the convenience of the model.
 *  - It never changes anyone's stored travel intention. It changes what is
 *    RECOMMENDED to them, and tells them it has changed and why. The person
 *    decides. Recommendations are suggestions, not instructions.
 *  - It never breaks a person's own constraints — required arrival, flexibility
 *    window and direction are all still enforced by `recommendDeparture`.
 *
 * DETERMINISM
 * Users are processed in a stable order (by id). Running the optimiser twice on
 * unchanged data produces exactly the same result, which is what makes the
 * outcome explainable and testable rather than a lottery.
 *
 * WHERE IT RUNS
 * Today it is called inline after a plan is confirmed — at this scale that is a
 * few dozen rows and costs milliseconds. In a real deployment this belongs on a
 * queue, triggered by a batch of confirmations rather than by each one.
 */

export interface ReoptimisationSummary {
  /** How many recommendations were examined. */
  considered: number;
  /** How many were actually changed. */
  updated: number;
  /** Slots that were at or above capacity before the pass, for reporting. */
  overloadedSlotsBefore: Array<{ minutes: number; label: string; index: number }>;
  /** Slots still at or above capacity afterwards. */
  overloadedSlotsAfter: Array<{ minutes: number; label: string; index: number }>;
}

/** Demand at a slot, using a provisional trip count instead of the stored one. */
function demandWithCounts(
  context: DemandContext,
  counts: Map<number, number>,
  slotMinutes: number
): number {
  const baseline = predictDemandIndex(context.cityCode, context.localDate, slotMinutes);
  const tripPressure = (counts.get(slotMinutes) ?? 0) * TRIP_WEIGHT;

  const eventPressure = context.events
    .filter(
      (event) => slotMinutes >= event.startMinutes && slotMinutes <= event.endMinutes
    )
    .reduce((total, event) => total + event.demandImpact, 0);

  return Math.max(0, Math.min(100, Math.round(baseline + tripPressure + eventPressure)));
}

/** Lists slots across the working day that are at or above capacity. */
function findOverloadedSlots(
  context: DemandContext,
  counts: Map<number, number>
): Array<{ minutes: number; label: string; index: number }> {
  const overloaded: Array<{ minutes: number; label: string; index: number }> = [];

  // 05:00 to 23:45 — the hours anyone realistically commutes in.
  for (let minutes = 5 * 60; minutes <= 23 * 60 + 45; minutes += 15) {
    const index = demandWithCounts(context, counts, minutes);
    if (index >= CAPACITY_THRESHOLD) {
      overloaded.push({ minutes, label: formatSlotLabel(minutes), index });
    }
  }

  return overloaded;
}

/**
 * Recalculates every pending recommendation for one city and date.
 *
 * @param cityCode   City to re-optimise.
 * @param travelDate Date-only value matching the stored `travelDate` column.
 * @param localDate  A Date whose local fields are that date in the app timezone.
 */
export async function reoptimiseCity(
  cityCode: CityCode,
  travelDate: Date,
  localDate: Date
): Promise<ReoptimisationSummary> {
  const context = await loadDemandContext(cityCode, travelDate, localDate);

  // Start from what people have actually confirmed. These are real commitments.
  const provisional = new Map(context.tripCounts);
  const overloadedBefore = findOverloadedSlots(context, provisional);

  // Every recommendation for this city and date, with the routine behind it.
  // The stable ordering is what makes the pass reproducible.
  const recommendations = await prisma.recommendation.findMany({
    where: { cityCode, travelDate },
    orderBy: { id: "asc" },
    include: { user: { include: { travelProfile: true } } },
  });

  let updated = 0;
  const updates: Array<{
    id: string;
    recommendedDeparture: string;
    demandAtUsual: number;
    demandAtRecommended: number;
    reason: string;
    updateReason: string;
  }> = [];

  for (const recommendation of recommendations) {
    const profile = recommendation.user.travelProfile;
    if (!profile) continue;

    // --- Already committed? Count them as load and leave them alone. --------
    if (recommendation.status !== "PENDING") {
      const committedSlot = roundToSlot(
        toMinutes(recommendation.chosenDeparture ?? recommendation.recommendedDeparture) ??
          0
      );
      provisional.set(committedSlot, (provisional.get(committedSlot) ?? 0) + 1);
      continue;
    }

    // --- Still open: recompute against demand INCLUDING everyone before them.
    const engine = recommendDeparture({
      demandAt: (slotMinutes) => demandWithCounts(context, provisional, slotMinutes),
      usualDeparture: profile.usualDeparture,
      requiredArrival: profile.requiredArrival,
      typicalJourneyMinutes: profile.typicalJourneyMinutes,
      isFlexible: profile.isFlexible,
      flexibilityMinutes: profile.flexibilityMinutes,
      willingToLeaveEarlier: profile.willingToLeaveEarlier,
      willingToLeaveLater: profile.willingToLeaveLater,
    });

    const previous = recommendation.recommendedDeparture;
    const next = engine.recommendedDeparture;

    if (next !== previous) {
      updates.push({
        id: recommendation.id,
        recommendedDeparture: next,
        demandAtUsual: engine.demandAtUsual,
        demandAtRecommended: engine.demandAtRecommended,
        reason: engine.reason,
        updateReason:
          `Your recommendation moved from ${formatSlotLabel(
            toMinutes(previous) ?? 0
          )} to ${formatSlotLabel(toMinutes(next) ?? 0)} because travel demand around ` +
          `that time changed — more people have now confirmed plans in the earlier slot. ` +
          `Your required arrival time is still respected.`,
      });
      updated += 1;
    }

    // This person now contributes to the load the NEXT person will see. That
    // single line is what turns "everyone gets told 8:45" into a spread.
    const takenSlot = roundToSlot(toMinutes(next) ?? 0);
    provisional.set(takenSlot, (provisional.get(takenSlot) ?? 0) + 1);
  }

  // ------------------------------------------------------------- persist
  // Sequential rather than a transaction: on a free-tier connection a long
  // transaction is more likely to time out than a handful of small writes, and
  // a partially applied pass is harmless — the next run corrects it.
  for (const update of updates) {
    await prisma.recommendation.update({
      where: { id: update.id },
      data: {
        recommendedDeparture: update.recommendedDeparture,
        demandAtUsual: update.demandAtUsual,
        demandAtRecommended: update.demandAtRecommended,
        reason: update.reason,
        updatedByOptimiser: true,
        updateReason: update.updateReason,
        updateAcknowledged: false,
      },
    });
  }

  return {
    considered: recommendations.length,
    updated,
    overloadedSlotsBefore: overloadedBefore,
    overloadedSlotsAfter: findOverloadedSlots(context, provisional),
  };
}
