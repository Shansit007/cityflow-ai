import { prisma } from "@/lib/db";
import type { CityCode } from "@/lib/cities";
import { appDateOnly } from "@/lib/app-time";
import { floorToSlot, formatSlotLabel, toMinutes } from "@/lib/demand/time-slots";
import { toZoneKey } from "@/lib/demand/zones";

/**
 * Demand Shift Intelligence — where departures actually moved, not just
 * whether a recommendation was offered.
 *
 * WHAT "ORIGINAL" AND "CURRENT" MEAN HERE
 * "Original" is always `usualDeparture` — the time the person's routine said
 * they normally leave. "Current" is the time they actually settled on, using
 * the exact same derivation `loadParticipationSummary` already uses:
 *
 *   ACCEPTED    -> recommendedDeparture (they took the suggestion)
 *   CUSTOM      -> chosenDeparture (they picked their own time)
 *   KEPT_USUAL  -> usualDeparture (no change, current = original)
 *   PENDING     -> excluded — nothing has been decided yet, so there is no
 *                  "current" to compare against
 *
 * WHY THIS IS A SEPARATE FILE FROM intent-intelligence.ts
 * `loadIntentIntelligence` answers "how is the chat assistant doing" — source
 * split, status split, a single average shift figure. This file answers a
 * different question — "if I look at the whole day, which slots are gaining
 * people and which are losing them" — which needs every recommendation's
 * before/after time, not just an average. Keeping them apart means neither
 * file has to know about the other's concerns.
 */

const WINDOW_DAYS = 30;

export interface DistributionBucket {
  /** "6 PM", the hour this bucket represents. */
  label: string;
  hour: number;
  originalCount: number;
  currentCount: number;
  /** 0-100, of every decided recommendation in the window. */
  originalPercent: number;
  currentPercent: number;
}

export interface SlotShift {
  label: string;
  minutes: number;
  originalCount: number;
  currentCount: number;
  /** currentCount - originalCount. Positive = gaining, negative = losing. */
  delta: number;
}

export interface ZoneShift {
  zoneLabel: string;
  zoneKey: string;
  /** Decided recommendations, linked to a journey in this zone, whose time actually changed. */
  movedCount: number;
}

export interface DemandTrendPoint {
  /** "2026-09-15" */
  date: string;
  confirmedTrips: number;
}

export interface DemandShiftIntelligence {
  windowDays: number;
  /** Decided recommendations (ACCEPTED, CUSTOM or KEPT_USUAL) in the window. */
  sampleSize: number;
  distribution: DistributionBucket[];
  /** The 5 slots with the largest positive delta (current - original). */
  gainers: SlotShift[];
  /** The 5 slots with the largest negative delta. */
  losers: SlotShift[];
  byZone: ZoneShift[];
  trend: DemandTrendPoint[];
}

export async function loadDemandShiftIntelligence(
  cityCode: CityCode
): Promise<DemandShiftIntelligence> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [recommendations, trendRows] = await Promise.all([
    prisma.recommendation.findMany({
      where: {
        cityCode,
        travelDate: { gte: since },
        status: { in: ["ACCEPTED", "CUSTOM", "KEPT_USUAL"] },
      },
      select: {
        status: true,
        usualDeparture: true,
        recommendedDeparture: true,
        chosenDeparture: true,
        journey: { select: { originArea: true } },
      },
    }),
    prisma.travelIntention.findMany({
      where: { cityCode, status: "CONFIRMED", createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ]);

  // Every hour of the day starts at zero so a quiet hour still appears in the
  // distribution, rather than silently vanishing from the chart.
  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    originalCount: 0,
    currentCount: 0,
  }));

  const bySlot = new Map<number, { originalCount: number; currentCount: number }>();
  const zoneMovedCount = new Map<string, { zoneLabel: string; count: number }>();

  let sampleSize = 0;

  for (const row of recommendations) {
    const current =
      row.status === "ACCEPTED"
        ? row.recommendedDeparture
        : row.status === "CUSTOM"
          ? row.chosenDeparture
          : row.usualDeparture;

    if (!current) continue;

    const originalMinutes = toMinutes(row.usualDeparture);
    const currentMinutes = toMinutes(current);
    if (originalMinutes === null || currentMinutes === null) continue;

    sampleSize += 1;

    hourly[Math.floor(originalMinutes / 60)].originalCount += 1;
    hourly[Math.floor(currentMinutes / 60)].currentCount += 1;

    const originalSlot = floorToSlot(originalMinutes);
    const currentSlot = floorToSlot(currentMinutes);
    if (!bySlot.has(originalSlot)) bySlot.set(originalSlot, { originalCount: 0, currentCount: 0 });
    if (!bySlot.has(currentSlot)) bySlot.set(currentSlot, { originalCount: 0, currentCount: 0 });
    bySlot.get(originalSlot)!.originalCount += 1;
    bySlot.get(currentSlot)!.currentCount += 1;

    if (row.journey && currentMinutes !== originalMinutes) {
      const zoneKey = toZoneKey(row.journey.originArea);
      const existing = zoneMovedCount.get(zoneKey);
      if (existing) existing.count += 1;
      else zoneMovedCount.set(zoneKey, { zoneLabel: row.journey.originArea, count: 1 });
    }
  }

  const distribution: DistributionBucket[] = hourly.map((bucket) => ({
    label: formatHourLabel(bucket.hour),
    hour: bucket.hour,
    originalCount: bucket.originalCount,
    currentCount: bucket.currentCount,
    originalPercent: sampleSize > 0 ? Math.round((bucket.originalCount / sampleSize) * 100) : 0,
    currentPercent: sampleSize > 0 ? Math.round((bucket.currentCount / sampleSize) * 100) : 0,
  }));

  const slotShifts: SlotShift[] = Array.from(bySlot.entries())
    .map(([minutes, counts]) => ({
      label: formatSlotLabel(minutes),
      minutes,
      originalCount: counts.originalCount,
      currentCount: counts.currentCount,
      delta: counts.currentCount - counts.originalCount,
    }))
    .filter((row) => row.delta !== 0);

  const gainers = slotShifts
    .filter((row) => row.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 5);
  const losers = slotShifts
    .filter((row) => row.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 5);

  const byZone: ZoneShift[] = Array.from(zoneMovedCount.entries())
    .map(([zoneKey, { zoneLabel, count }]) => ({ zoneKey, zoneLabel, movedCount: count }))
    .sort((a, b) => b.movedCount - a.movedCount)
    .slice(0, 8);

  // Trend: confirmed plans per calendar day over the window, in this city's
  // own timezone-free date key — a simple day bucket, not a moment in time.
  const trendByDate = new Map<string, number>();
  for (const row of trendRows) {
    const dateKey = row.createdAt.toISOString().slice(0, 10);
    trendByDate.set(dateKey, (trendByDate.get(dateKey) ?? 0) + 1);
  }
  const trend: DemandTrendPoint[] = Array.from(trendByDate.entries())
    .map(([date, confirmedTrips]) => ({ date, confirmedTrips }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    windowDays: WINDOW_DAYS,
    sampleSize,
    distribution,
    gainers,
    losers,
    byZone,
    trend,
  };
}

function formatHourLabel(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour} ${period}`;
}


/**
 * "Live City Behavior" — one consolidated read of today, for the Overview
 * card. Deliberately narrower than `loadDemandShiftIntelligence` above: that
 * function looks back 30 days to have enough recommendations for a stable
 * distribution; this one looks at today only, because the whole point of the
 * card is "what is happening right now", not a rolling average.
 */
export interface TodayShiftSummary {
  usersShiftingToday: number;
  mostSelectedNewSlot: { label: string; count: number } | null;
  /** Confirmed plans today vs yesterday. Null on a city's very first day. */
  trend: "rising" | "falling" | "flat" | null;
}

export async function loadTodayShiftSummary(cityCode: CityCode): Promise<TodayShiftSummary> {
  const today = appDateOnly();
  const yesterday = appDateOnly(new Date(today.getTime() - 24 * 60 * 60 * 1000));

  const [decidedToday, confirmedToday, confirmedYesterday] = await Promise.all([
    prisma.recommendation.findMany({
      where: { cityCode, travelDate: today, status: { in: ["ACCEPTED", "CUSTOM", "KEPT_USUAL"] } },
      select: { status: true, usualDeparture: true, recommendedDeparture: true, chosenDeparture: true },
    }),
    prisma.travelIntention.count({
      where: { cityCode, status: "CONFIRMED", createdAt: { gte: today } },
    }),
    prisma.travelIntention.count({
      where: { cityCode, status: "CONFIRMED", createdAt: { gte: yesterday, lt: today } },
    }),
  ]);

  let usersShiftingToday = 0;
  const newSlotCounts = new Map<number, number>();

  for (const row of decidedToday) {
    const current =
      row.status === "ACCEPTED"
        ? row.recommendedDeparture
        : row.status === "CUSTOM"
          ? row.chosenDeparture
          : row.usualDeparture;
    if (!current) continue;

    const originalMinutes = toMinutes(row.usualDeparture);
    const currentMinutes = toMinutes(current);
    if (originalMinutes === null || currentMinutes === null) continue;
    if (currentMinutes === originalMinutes) continue;

    usersShiftingToday += 1;
    const slot = floorToSlot(currentMinutes);
    newSlotCounts.set(slot, (newSlotCounts.get(slot) ?? 0) + 1);
  }

  let mostSelectedNewSlot: { label: string; count: number } | null = null;
  for (const [minutes, count] of newSlotCounts) {
    if (!mostSelectedNewSlot || count > mostSelectedNewSlot.count) {
      mostSelectedNewSlot = { label: formatSlotLabel(minutes), count };
    }
  }

  const trend =
    confirmedYesterday === 0 && confirmedToday === 0
      ? null
      : confirmedToday > confirmedYesterday
        ? "rising"
        : confirmedToday < confirmedYesterday
          ? "falling"
          : "flat";

  return { usersShiftingToday, mostSelectedNewSlot, trend };
}
