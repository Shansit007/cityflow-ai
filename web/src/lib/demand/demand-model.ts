import type { CityCode } from "@/lib/cities";
import { SLOT_MINUTES, isWeekend, slotRange, toTimeString } from "@/lib/demand/time-slots";

/**
 * Predicted travel demand.
 *
 * ============================ HONESTY NOTE ==================================
 * The numbers this file produces are a MODELLED BASELINE, not measured traffic.
 * CityFlow AI does not yet have a live feed of real trips, and inventing one
 * would make every downstream claim dishonest.
 *
 * What the model does represent is the shape that urban travel demand reliably
 * takes: a low overnight floor, a sharp morning commute peak, a smaller midday
 * bump, a broader and later evening peak, and a much flatter weekend.
 *
 * Everything the UI says about these numbers is phrased as "predicted" or
 * "expected", never as fact.
 *
 * WHERE THE REAL DATA PLUGS IN
 * `predictDemandIndex()` is the single seam. In Phase 3, confirmed travel
 * intentions are aggregated per zone and slot and added on top of this
 * baseline; in a deployment with real traffic feeds, the baseline itself is
 * replaced by observed counts. Nothing in the UI has to change — every screen
 * already reads through this one function.
 * ============================================================================
 */

/** Demand expressed on a 0-100 index, where 100 is far beyond comfortable road capacity. */
export type DemandIndex = number;

export type DemandLevel = "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";

/** Where each level starts on the 0-100 index. */
const LEVEL_THRESHOLDS: Array<{ level: DemandLevel; min: number }> = [
  { level: "VERY_HIGH", min: 82 },
  { level: "HIGH", min: 62 },
  { level: "MODERATE", min: 38 },
  { level: "LOW", min: 0 },
];

export function levelForIndex(index: DemandIndex): DemandLevel {
  return LEVEL_THRESHOLDS.find((threshold) => index >= threshold.min)!.level;
}

/** Human-readable label for each level. */
export const DEMAND_LEVEL_LABEL: Record<DemandLevel, string> = {
  LOW: "Low",
  MODERATE: "Moderate",
  HIGH: "High",
  VERY_HIGH: "Very high",
};

/**
 * How much longer a journey is expected to take at each demand level, as a
 * multiplier on the person's own "normal" journey time.
 *
 * These are conservative, round figures — presented to the user as estimates,
 * never as a promise of minutes saved.
 */
const CONGESTION_MULTIPLIER: Record<DemandLevel, number> = {
  LOW: 1.0,
  MODERATE: 1.15,
  HIGH: 1.4,
  VERY_HIGH: 1.75,
};

/**
 * Estimated journey time at a given demand level.
 *
 * @param typicalMinutes The person's own light-traffic journey time.
 */
export function estimateJourneyMinutes(
  typicalMinutes: number,
  index: DemandIndex
): number {
  return Math.round(typicalMinutes * CONGESTION_MULTIPLIER[levelForIndex(index)]);
}

/* -------------------------------------------------------------------------- */
/*  The baseline curve                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Relative demand pressure per city.
 *
 * Larger, denser networks sit closer to capacity at the same hour, so the same
 * peak shape reaches a higher index. These are coarse, deliberately: they say
 * "Mumbai's peak bites harder than Bhopal's", which is uncontroversial, and
 * they do not pretend to be calibrated measurements.
 */
const CITY_PRESSURE: Record<CityCode, number> = {
  delhi: 1.0,
  mumbai: 1.0,
  bengaluru: 0.98,
  hyderabad: 0.9,
  chennai: 0.88,
  kolkata: 0.9,
  pune: 0.84,
  bhopal: 0.7,
};

/** One bell-shaped peak in the day. */
interface Peak {
  /** Centre of the peak, in minutes since midnight. */
  centre: number;
  /** Height of the peak before city scaling. */
  height: number;
  /** How spread out the peak is, in minutes. Larger = flatter, wider. */
  spread: number;
}

const WEEKDAY_PEAKS: Peak[] = [
  { centre: 9 * 60, height: 74, spread: 52 }, // morning commute
  { centre: 13 * 60, height: 22, spread: 55 }, // midday errands
  { centre: 18 * 60 + 30, height: 78, spread: 68 }, // evening commute, broader
];

const WEEKEND_PEAKS: Peak[] = [
  { centre: 11 * 60 + 30, height: 30, spread: 110 },
  { centre: 19 * 60, height: 40, spread: 110 },
];

/** Baseline traffic that exists at any hour. */
const FLOOR = 6;

function bell(minuteOfDay: number, peak: Peak): number {
  const distance = minuteOfDay - peak.centre;
  return peak.height * Math.exp(-(distance * distance) / (2 * peak.spread * peak.spread));
}

/* -------------------------------------------------------------------------- */
/*  Day-to-day variation                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A small deterministic wobble, so demand is not identical every single day.
 *
 * It MUST be deterministic: the same city, date and slot always produce the
 * same number. If this used Math.random(), the dashboard would show a different
 * figure on every page refresh, the server and browser would disagree, and the
 * stored reason for a recommendation would stop matching what the user sees.
 *
 * FNV-1a is used because it is tiny, dependency-free and well distributed.
 */
function deterministicNoise(seed: string): number {
  let hash = 0x811c9dc5;

  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  // Map to -1 .. 1
  return ((hash >>> 0) / 0xffffffff) * 2 - 1;
}

/** YYYY-MM-DD in local time, used as part of the noise seed. */
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Predicted demand index (0-100) for one 15-minute slot.
 *
 * THIS IS THE SEAM. Real aggregated demand replaces or augments the baseline
 * here, and every screen in the product picks up the change automatically.
 *
 * @param cityCode Which city's pressure profile to use.
 * @param date     The travel date (weekday vs weekend, plus the daily wobble).
 * @param slotMinutes Slot start, in minutes since midnight.
 */
export function predictDemandIndex(
  cityCode: CityCode,
  date: Date,
  slotMinutes: number
): DemandIndex {
  const peaks = isWeekend(date) ? WEEKEND_PEAKS : WEEKDAY_PEAKS;
  const pressure = CITY_PRESSURE[cityCode] ?? 0.9;

  const shape = peaks.reduce((total, peak) => total + bell(slotMinutes, peak), FLOOR);

  // ±7 points of day-to-day variation.
  const wobble = deterministicNoise(`${cityCode}|${dateKey(date)}|${slotMinutes}`) * 7;

  const index = shape * pressure + wobble;

  return Math.max(0, Math.min(100, Math.round(index)));
}

/** One slot's worth of predicted demand, ready for the UI. */
export interface DemandSlot {
  /** Slot start in minutes since midnight. */
  minutes: number;
  /** "08:45" */
  time: string;
  index: DemandIndex;
  level: DemandLevel;
  label: string;
}

/**
 * Predicted demand across a range of the day.
 * Used by the dashboard's "upcoming peak" strip and, later, by the Admin Portal.
 */
export function predictDemandCurve(
  cityCode: CityCode,
  date: Date,
  fromMinutes: number,
  toMinutes: number
): DemandSlot[] {
  return slotRange(fromMinutes, toMinutes).map((minutes) => {
    const index = predictDemandIndex(cityCode, date, minutes);
    const level = levelForIndex(index);

    return {
      minutes,
      // toTimeString wraps around midnight, so a window that runs past 23:59 —
      // or starts before 00:00 — still produces a valid "HH:MM".
      time: toTimeString(minutes),
      index,
      level,
      label: DEMAND_LEVEL_LABEL[level],
    };
  });
}

/**
 * The single worst slot in a range — "the peak you are heading into".
 * Returns null when the range is empty.
 */
export function findPeakSlot(slots: DemandSlot[]): DemandSlot | null {
  if (slots.length === 0) return null;

  return slots.reduce((worst, slot) => (slot.index > worst.index ? slot : worst));
}

/** Convenience: current demand for a city, rounded to the containing slot. */
export function currentDemand(cityCode: CityCode, now: Date = new Date()): DemandSlot {
  const minutes =
    Math.floor((now.getHours() * 60 + now.getMinutes()) / SLOT_MINUTES) * SLOT_MINUTES;
  const index = predictDemandIndex(cityCode, now, minutes);
  const level = levelForIndex(index);

  return {
    minutes,
    time: toTimeString(minutes),
    index,
    level,
    label: DEMAND_LEVEL_LABEL[level],
  };
}
