import type { CityCode } from "@/lib/cities";
import { prisma } from "@/lib/db";
import {
  DEMAND_LEVEL_LABEL,
  levelForIndex,
  predictDemandIndex,
  type DemandSlot,
} from "@/lib/demand/demand-model";
import { slotRange, toTimeString } from "@/lib/demand/time-slots";

/**
 * ADJUSTED DEMAND — the number the whole product actually runs on.
 *
 *      adjusted(slot)  =  baseline(slot)
 *                      +  confirmed trips in that slot  × TRIP_WEIGHT
 *                      +  impact of any active network event
 *
 * This is the heart of Phase 3, and the reason CityFlow AI does not simply
 * relocate a jam. The baseline says "9:00 is usually busy". The confirmed-trip
 * term says "and 47 people have now told us they are leaving at 8:45". As soon
 * as enough people move to a quiet slot, that slot stops being quiet — for
 * everyone, immediately, including the next person who asks.
 *
 * PRIVACY
 * The aggregate table this reads holds counts only: city, date, slot, number of
 * trips. No user id, no CityFlow ID, no route. A row cannot be traced back to a
 * person even in principle.
 */

/**
 * How many demand-index points one confirmed trip adds.
 *
 * WHY THIS NUMBER IS SMALL AND HONEST
 * A real city has hundreds of thousands of trips per slot, and one extra car is
 * meaningless. CityFlow AI has a handful of registered users, so a literal count
 * would never move the index at all and the smoothing behaviour could never be
 * demonstrated or tested.
 *
 * The weight below treats each confirmed trip as representing a slice of the
 * travelling public — the same assumption any sampled travel survey makes. It
 * is a MODELLING CHOICE, not a measurement, and it is the single number to
 * change when real trip volumes are available.
 */
export const TRIP_WEIGHT = 2.5;

/**
 * The index above which a slot is considered over comfortable capacity.
 * Matches the "VERY_HIGH" threshold in the demand model, so what the optimiser
 * calls overloaded is exactly what the UI shows as "Very high".
 */
export const CAPACITY_THRESHOLD = 82;

/** Confirmed trips per slot, keyed by slot start in minutes since midnight. */
export type TripCounts = Map<number, number>;

/**
 * Reads the confirmed-trip counts for a city and date.
 * Slots with no confirmed trips are simply absent from the map.
 */
export async function loadTripCounts(
  cityCode: CityCode,
  travelDate: Date
): Promise<TripCounts> {
  const rows = await prisma.demandSlotAggregate.findMany({
    where: { cityCode, travelDate },
    select: { slotMinutes: true, confirmedTrips: true },
  });

  return new Map(rows.map((row) => [row.slotMinutes, row.confirmedTrips]));
}

/** An active network event, reduced to what the demand maths needs. */
interface EventImpact {
  startMinutes: number;
  endMinutes: number;
  demandImpact: number;
}

/**
 * Reads active network events for a city and date.
 *
 * NOTHING WRITES THESE AUTOMATICALLY YET. There is no accident or closure feed
 * connected. Rows are entered by hand. The path exists so that connecting a
 * feed later is a matter of inserting rows — prediction, recommendation,
 * re-optimisation and notification already work end to end.
 *
 * Weather is NOT part of this table and is not what this comment is about —
 * it already has its own live feed (Open-Meteo, no key needed), fetched
 * directly in `recommendation-service.ts` via `lib/weather.ts` rather than
 * being written here as a NetworkEvent row.
 */
export async function loadEventImpacts(
  cityCode: CityCode,
  travelDate: Date
): Promise<EventImpact[]> {
  const rows = await prisma.networkEvent.findMany({
    where: { cityCode, eventDate: travelDate, active: true },
    select: { startMinutes: true, endMinutes: true, demandImpact: true },
  });

  return rows;
}

/**
 * Everything needed to compute adjusted demand, loaded once.
 *
 * Fetching this once and passing it around matters: the recommendation engine
 * asks for a demand value slot by slot, and the optimiser does it for many
 * people at a time. Hitting the database inside that loop would be dozens of
 * round trips on a free-tier connection.
 */
export interface DemandContext {
  cityCode: CityCode;
  /** A Date whose local fields are the travel date in the app timezone. */
  localDate: Date;
  tripCounts: TripCounts;
  events: EventImpact[];
}

/** Loads the demand context for a city and date. */
export async function loadDemandContext(
  cityCode: CityCode,
  travelDate: Date,
  localDate: Date
): Promise<DemandContext> {
  const [tripCounts, events] = await Promise.all([
    loadTripCounts(cityCode, travelDate),
    loadEventImpacts(cityCode, travelDate),
  ]);

  return { cityCode, localDate, tripCounts, events };
}

/**
 * The adjusted demand index for one slot.
 *
 * This is the function passed into `recommendDeparture` as `demandAt`, and the
 * one the optimiser uses to decide whether a slot is over capacity.
 */
export function adjustedDemandAt(context: DemandContext, slotMinutes: number): number {
  const baseline = predictDemandIndex(context.cityCode, context.localDate, slotMinutes);

  const trips = context.tripCounts.get(slotMinutes) ?? 0;
  const tripPressure = trips * TRIP_WEIGHT;

  const eventPressure = context.events
    .filter(
      (event) => slotMinutes >= event.startMinutes && slotMinutes <= event.endMinutes
    )
    .reduce((total, event) => total + event.demandImpact, 0);

  return Math.max(0, Math.min(100, Math.round(baseline + tripPressure + eventPressure)));
}

/** Convenience: bind a context into the `demandAt` function shape. */
export function demandAtFor(context: DemandContext): (slotMinutes: number) => number {
  return (slotMinutes) => adjustedDemandAt(context, slotMinutes);
}

/** A slot of adjusted demand, with the breakdown kept for the UI and Admin Portal. */
export interface AdjustedDemandSlot extends DemandSlot {
  /** What the model alone predicted, before anyone's confirmed plans. */
  baselineIndex: number;
  /** How many confirmed trips are counted in this slot. */
  confirmedTrips: number;
  /** True when the slot is at or above comfortable capacity. */
  overCapacity: boolean;
}

/** Builds the adjusted demand curve across a range of the day. */
export function buildAdjustedCurve(
  context: DemandContext,
  fromMinutes: number,
  toMinutes: number
): AdjustedDemandSlot[] {
  return slotRange(fromMinutes, toMinutes).map((minutes) => {
    const baselineIndex = predictDemandIndex(
      context.cityCode,
      context.localDate,
      minutes
    );
    const index = adjustedDemandAt(context, minutes);
    const level = levelForIndex(index);

    return {
      minutes,
      time: toTimeString(minutes),
      index,
      level,
      label: DEMAND_LEVEL_LABEL[level],
      baselineIndex,
      confirmedTrips: context.tripCounts.get(minutes) ?? 0,
      overCapacity: index >= CAPACITY_THRESHOLD,
    };
  });
}

/* -------------------------------------------------------------------------- */
/*  Writing to the aggregate                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Moves one trip between slots in the aggregate table.
 *
 * Pass `null` for `fromSlot` when a trip is being added for the first time, and
 * `null` for `toSlot` when a trip is being cancelled.
 *
 * The counter is never allowed below zero: a bug elsewhere should show up as a
 * count that is too low, not as a negative number that quietly makes a busy
 * slot look empty.
 */
export async function moveTripInAggregate(args: {
  cityCode: CityCode;
  travelDate: Date;
  fromSlot: number | null;
  toSlot: number | null;
}): Promise<void> {
  const { cityCode, travelDate, fromSlot, toSlot } = args;

  if (fromSlot === toSlot) return;

  if (fromSlot !== null) {
    const existing = await prisma.demandSlotAggregate.findUnique({
      where: {
        cityCode_travelDate_slotMinutes: { cityCode, travelDate, slotMinutes: fromSlot },
      },
      select: { id: true, confirmedTrips: true },
    });

    if (existing) {
      await prisma.demandSlotAggregate.update({
        where: { id: existing.id },
        data: { confirmedTrips: Math.max(0, existing.confirmedTrips - 1) },
      });
    }
  }

  if (toSlot !== null) {
    await prisma.demandSlotAggregate.upsert({
      where: {
        cityCode_travelDate_slotMinutes: { cityCode, travelDate, slotMinutes: toSlot },
      },
      create: { cityCode, travelDate, slotMinutes: toSlot, confirmedTrips: 1 },
      update: { confirmedTrips: { increment: 1 } },
    });
  }
}
