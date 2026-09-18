import {
  DEMAND_LEVEL_LABEL,
  type DemandLevel,
  estimateJourneyMinutes,
  levelForIndex,
} from "@/lib/demand/demand-model";
import {
  SLOT_MINUTES,
  formatSlotLabel,
  roundToSlot,
  slotRange,
  toMinutes,
  toTimeString,
} from "@/lib/demand/time-slots";

/**
 * The departure-time recommendation engine.
 *
 * WHAT IT DOES
 * Looks only at the slots this particular person said they could actually use,
 * discards any that would make them late, and picks the one with the lowest
 * predicted demand. Then it explains itself.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *  - It never suggests a time that breaks the person's required arrival.
 *  - It never moves someone earlier if they said they cannot leave earlier.
 *  - It does not suggest a change for the sake of it: if the best alternative
 *    is barely better than their usual time, it recommends keeping the usual
 *    time and says so.
 *  - It does not promise minutes saved. It reports predicted demand, and
 *    estimated arrival based on the journey time the USER gave us.
 *
 * HOW THE "DO NOT JUST MOVE THE PEAK" RULE IS ENFORCED
 * This function on its own would happily send everybody to the same quiet slot.
 * It does not, because the demand values it reads (`demandAt`) already include
 * every other person's confirmed departure for that day. So the moment people
 * start moving to 8:45, 8:45's index rises and stops being the answer.
 * `lib/demand/optimizer.ts` then re-spreads anyone already assigned to a slot
 * that has tipped over capacity. See docs/ARCHITECTURE.md §4c.
 */

export interface RecommendationInput {
  /**
   * Predicted demand index (0-100) for a slot, given as a function.
   *
   * WHY INJECTED RATHER THAN LOOKED UP HERE
   * In Phase 2 this was always the baseline model. From Phase 3 it is the
   * ADJUSTED curve: baseline + other people's confirmed trips + any network
   * events. Passing it in keeps this engine pure — it has no idea where the
   * numbers came from, which is what lets the same code serve both a single
   * commuter and the city-wide optimiser.
   */
  demandAt: (slotMinutes: number) => number;
  /** "HH:MM" */
  usualDeparture: string;
  /** "HH:MM" — the time they must have arrived by. */
  requiredArrival: string;
  /** The person's own light-traffic journey time, in minutes. */
  typicalJourneyMinutes: number;
  isFlexible: boolean;
  /** How far the departure may move, in minutes. */
  flexibilityMinutes: number;
  willingToLeaveEarlier: boolean;
  willingToLeaveLater: boolean;
}

/** One candidate departure time, fully evaluated. */
export interface DepartureOption {
  /** Slot start in minutes since midnight. */
  minutes: number;
  /** "08:45" */
  time: string;
  /** "8:45 AM" */
  label: string;
  demandIndex: number;
  demandLevel: DemandLevel;
  demandLabel: string;
  /** Estimated journey length at this slot's demand level. */
  estimatedJourneyMinutes: number;
  /** "09:10" */
  estimatedArrival: string;
  /** False when this option would make the person late. */
  arrivesInTime: boolean;
  isUsual: boolean;
}

export interface RecommendationResult {
  /** "08:45" — may equal the usual departure when no change is worthwhile. */
  recommendedDeparture: string;
  usualDeparture: string;

  demandAtUsual: number;
  demandAtRecommended: number;
  levelAtUsual: DemandLevel;
  levelAtRecommended: DemandLevel;

  /** True when the engine is actually suggesting a different time. */
  suggestsChange: boolean;

  /** One sentence: why this time. Stored with the recommendation. */
  reason: string;
  /** One sentence: what the person might get out of it. Carefully hedged. */
  benefit: string;

  /** Estimated arrival if they take the recommendation. */
  estimatedArrival: string;
  estimatedJourneyMinutes: number;

  /** Every slot considered, so the UI can show the working. */
  options: DepartureOption[];

  /**
   * Set when no option inside the person's window arrives in time. The UI
   * surfaces this instead of silently recommending something unusable.
   */
  warning: string | null;
}

/**
 * How much lower the predicted demand has to be before a change is worth
 * suggesting. Below this, asking someone to reorganise their morning is not
 * justified by the model's own precision.
 */
const MIN_MEANINGFUL_IMPROVEMENT = 8;

/** Fallbacks used only if a stored profile somehow holds an invalid time. */
const FALLBACK_DEPARTURE = 9 * 60;
const FALLBACK_ARRIVAL = 9 * 60 + 30;

function buildOption(
  input: RecommendationInput,
  slotMinutes: number,
  usualSlot: number,
  arrivalDeadline: number
): DepartureOption {
  const demandIndex = input.demandAt(slotMinutes);
  const demandLevel = levelForIndex(demandIndex);
  const estimatedJourney = estimateJourneyMinutes(
    input.typicalJourneyMinutes,
    demandIndex
  );
  const arrivalMinutes = slotMinutes + estimatedJourney;

  return {
    minutes: slotMinutes,
    time: toTimeString(slotMinutes),
    label: formatSlotLabel(slotMinutes),
    demandIndex,
    demandLevel,
    demandLabel: DEMAND_LEVEL_LABEL[demandLevel],
    estimatedJourneyMinutes: estimatedJourney,
    estimatedArrival: toTimeString(arrivalMinutes),
    arrivesInTime: arrivalMinutes <= arrivalDeadline,
    isUsual: slotMinutes === usualSlot,
  };
}

export function recommendDeparture(input: RecommendationInput): RecommendationResult {
  // ------------------------------------------------------------ 1. Read times
  const usualSlot = roundToSlot(toMinutes(input.usualDeparture) ?? FALLBACK_DEPARTURE);

  let arrivalDeadline = toMinutes(input.requiredArrival) ?? FALLBACK_ARRIVAL;
  // An arrival "before" the departure means the journey crosses midnight.
  if (arrivalDeadline < usualSlot) arrivalDeadline += 24 * 60;

  // -------------------------------------------------- 2. The allowed window
  // Only widen the window in directions the person actually agreed to.
  const flex = input.isFlexible ? Math.max(0, input.flexibilityMinutes) : 0;
  const earliest = input.willingToLeaveEarlier ? usualSlot - flex : usualSlot;
  const latest = input.willingToLeaveLater ? usualSlot + flex : usualSlot;

  const candidateSlots = slotRange(earliest, latest);

  // The usual slot is always evaluated, even if flexibility is zero.
  if (!candidateSlots.includes(usualSlot)) candidateSlots.push(usualSlot);
  candidateSlots.sort((a, b) => a - b);

  const options = candidateSlots.map((slot) =>
    buildOption(input, slot, usualSlot, arrivalDeadline)
  );

  const usualOption = options.find((option) => option.isUsual)!;

  // ------------------------------------------------- 3. Discard unusable slots
  const viable = options.filter((option) => option.arrivesInTime);

  let warning: string | null = null;
  let searchSpace = viable;

  if (viable.length === 0) {
    // Every option in the window is predicted to arrive late. Say so plainly
    // rather than recommending something that does not work.
    warning =
      "Every departure time in your flexible window is predicted to arrive after your required arrival time. You may need an earlier departure or a longer flexibility window.";
    searchSpace = options;
  }

  // ------------------------------------------------------- 4. Pick the best
  const best = searchSpace.reduce((bestSoFar, option) => {
    if (option.demandIndex < bestSoFar.demandIndex) return option;

    // Tie-break towards the time closest to the person's normal routine —
    // the smallest disruption wins.
    if (option.demandIndex === bestSoFar.demandIndex) {
      const optionShift = Math.abs(option.minutes - usualSlot);
      const bestShift = Math.abs(bestSoFar.minutes - usualSlot);
      if (optionShift < bestShift) return option;
    }

    return bestSoFar;
  });

  const improvement = usualOption.demandIndex - best.demandIndex;
  const suggestsChange =
    best.minutes !== usualSlot && improvement >= MIN_MEANINGFUL_IMPROVEMENT;

  const chosen = suggestsChange ? best : usualOption;

  // -------------------------------------------------------- 5. Explain it
  const { reason, benefit } = explain({
    suggestsChange,
    chosen,
    usualOption,
    isFlexible: input.isFlexible,
    requiredArrival: input.requiredArrival,
  });

  return {
    recommendedDeparture: chosen.time,
    usualDeparture: usualOption.time,
    demandAtUsual: usualOption.demandIndex,
    demandAtRecommended: chosen.demandIndex,
    levelAtUsual: usualOption.demandLevel,
    levelAtRecommended: chosen.demandLevel,
    suggestsChange,
    reason,
    benefit,
    estimatedArrival: chosen.estimatedArrival,
    estimatedJourneyMinutes: chosen.estimatedJourneyMinutes,
    options,
    warning,
  };
}

/**
 * Builds the two sentences shown under every recommendation.
 *
 * Wording rules followed here:
 *  - always "predicted" / "expected", never stated as fact
 *  - never a promise of minutes saved
 *  - always mentions the arrival constraint, because that is the thing the
 *    person is really worried about
 */
function explain(args: {
  suggestsChange: boolean;
  chosen: DepartureOption;
  usualOption: DepartureOption;
  isFlexible: boolean;
  requiredArrival: string;
}): { reason: string; benefit: string } {
  const { suggestsChange, chosen, usualOption, isFlexible, requiredArrival } = args;

  const arrivalLabel = formatSlotLabel(toMinutes(requiredArrival) ?? FALLBACK_ARRIVAL);

  if (!suggestsChange) {
    if (!isFlexible) {
      return {
        reason: `Your departure time is set as fixed, so CityFlow AI is not suggesting a change. Predicted demand around ${usualOption.label} is ${usualOption.demandLabel.toLowerCase()}.`,
        benefit:
          "You can allow a flexible window in your profile at any time if you would like departure suggestions.",
      };
    }

    return {
      reason: `Predicted demand around your usual ${usualOption.label} departure is ${usualOption.demandLabel.toLowerCase()}, and no nearby time in your flexible window is meaningfully quieter.`,
      benefit: `Keeping your usual time looks reasonable today. Estimated arrival is around ${formatSlotLabel(
        toMinutes(usualOption.estimatedArrival)!
      )}, within your ${arrivalLabel} requirement.`,
    };
  }

  const shiftMinutes = chosen.minutes - usualOption.minutes;
  const direction = shiftMinutes < 0 ? "earlier" : "later";
  const shiftLabel = `${Math.abs(shiftMinutes)} minutes ${direction}`;

  return {
    reason: `Traffic demand around ${usualOption.label} is predicted to be ${usualOption.demandLabel.toLowerCase()}, while demand around ${chosen.label} is predicted to be ${chosen.demandLabel.toLowerCase()}.`,
    benefit: `Leaving about ${shiftLabel} may help you avoid the predicted peak, and still puts your estimated arrival around ${formatSlotLabel(
      toMinutes(chosen.estimatedArrival)!
    )} — within your ${arrivalLabel} requirement.`,
  };
}

/**
 * The slots shown in the dashboard's "upcoming peak" strip: a short window
 * around the person's usual departure, so the shape of the peak is visible.
 */
export function peakStripRange(usualDeparture: string): {
  from: number;
  to: number;
} {
  const usual = roundToSlot(toMinutes(usualDeparture) ?? FALLBACK_DEPARTURE);

  return {
    from: usual - 3 * SLOT_MINUTES,
    to: usual + 4 * SLOT_MINUTES,
  };
}
