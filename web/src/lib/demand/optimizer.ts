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
  /**
   * WHY the rest did not move.
   *
   * Added because a pass that reports only "11 of 601 changed" is impossible to
   * act on: it could be a broken engine, an over-strict threshold, a population
   * with no flexibility, or arrival deadlines blocking every alternative. Those
   * call for completely different responses, and guessing between them wasted a
   * whole evening once. The counts below are cheap and make the pass legible.
   */
  breakdown: {
    /** Already committed to a time. Counted as load, never moved. */
    alreadyCommitted: number;
    /** No travel routine, so nothing to work from. */
    noProfile: number;
    /** Said their departure cannot move at all. */
    notFlexible: number;
    /** Flexible, but no slot in their window was enough better to justify it. */
    noWorthwhileSlot: number;
    /** Actually moved. */
    moved: number;
  };
  /**
   * How much better the best alternative was, for flexible people who did NOT
   * move — the distribution that decides whether MIN_MEANINGFUL_IMPROVEMENT is
   * set sensibly for this population.
   */
  missedByImprovement: { none: number; under4: number; under8: number };
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

  // Every recommendation for this city and date, with the routine behind it.
  // The stable ordering is what makes the pass reproducible.
  const recommendations = await prisma.recommendation.findMany({
    where: { cityCode, travelDate },
    orderBy: { id: "asc" },
    include: { user: { include: { travelProfile: true } } },
  });

  /*
    ================== MEASURING "BEFORE" LIKE FOR LIKE ======================
    An earlier version measured the before-state from confirmed trips alone,
    then measured the after-state from confirmed trips PLUS all 601 people the
    pass had just placed. Those are not the same population, so the pass always
    appeared to invent congestion out of nothing — "0 slots over capacity
    before, 10 after" — which reads as the optimiser doing the precise thing
    this project exists to avoid.

    It was a measurement artefact, not a behaviour. Both snapshots now count the
    SAME people: everybody's confirmed trips plus every recommendation. The only
    difference between them is the times, which is the only difference there
    should be.
    ==========================================================================
  */
  const currentCounts = new Map(context.tripCounts);
  for (const recommendation of recommendations) {
    const slot = roundToSlot(
      toMinutes(recommendation.chosenDeparture ?? recommendation.recommendedDeparture) ?? 0
    );
    currentCounts.set(slot, (currentCounts.get(slot) ?? 0) + 1);
  }
  const overloadedBefore = findOverloadedSlots(context, currentCounts);

  // Start from what people have actually confirmed. These are real commitments.
  const provisional = new Map(context.tripCounts);

  let updated = 0;
  const breakdown = {
    alreadyCommitted: 0,
    noProfile: 0,
    notFlexible: 0,
    noWorthwhileSlot: 0,
    moved: 0,
  };
  const missedByImprovement = { none: 0, under4: 0, under8: 0 };

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
    if (!profile) {
      breakdown.noProfile += 1;
      continue;
    }

    // --- Already committed? Count them as load and leave them alone. --------
    if (recommendation.status !== "PENDING") {
      breakdown.alreadyCommitted += 1;
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

    /*
      Record why this person stayed put. `suggestsChange` is false either
      because nothing in their window was better, or because the best thing in
      it was not better by MIN_MEANINGFUL_IMPROVEMENT. Those are different
      problems and the distribution below tells them apart.
    */
    if (!engine.suggestsChange) {
      if (!profile.isFlexible) {
        breakdown.notFlexible += 1;
      } else {
        breakdown.noWorthwhileSlot += 1;

        const best = engine.options
          .filter((option) => option.arrivesInTime)
          .reduce<number | null>(
            (lowest, option) =>
              lowest === null || option.demandIndex < lowest ? option.demandIndex : lowest,
            null
          );

        const gap = best === null ? 0 : engine.demandAtUsual - best;
        if (gap <= 0) missedByImprovement.none += 1;
        else if (gap < 4) missedByImprovement.under4 += 1;
        else missedByImprovement.under8 += 1;
      }
    }

    if (next !== previous) {
      breakdown.moved += 1;
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
    breakdown,
    missedByImprovement,
    overloadedSlotsBefore: overloadedBefore,
    overloadedSlotsAfter: findOverloadedSlots(context, provisional),
  };
}
