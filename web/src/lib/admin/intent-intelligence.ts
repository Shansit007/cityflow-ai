import { prisma } from "@/lib/db";
import type { CityCode } from "@/lib/cities";
import { toMinutes } from "@/lib/demand/time-slots";

/**
 * AI Travel-Intent Intelligence — how people are actually changing their
 * plans, in aggregate, for one city.
 *
 * WHAT THIS IS AND IS NOT
 * A `TravelIntention` row is created whenever Saarthi (chat) or the dashboard
 * changes someone's departure time, mode, or cancels a trip for a date. This
 * file answers "in the aggregate, how much are people moving, in which
 * direction, and is it the chat assistant or the dashboard driving that" —
 * never anything about one person's plan. No chat text, no user id, no
 * journey label is ever selected here.
 *
 * WHY THE WINDOW
 * Intentions accumulate forever. Scoping to the last WINDOW_DAYS keeps the
 * numbers meaningful ("how are people behaving lately") instead of being
 * dominated by history, and keeps the one per-row scan below bounded.
 */

const WINDOW_DAYS = 30;
const ROW_SCAN_LIMIT = 3000;

export interface IntentSourceBreakdown {
  chat: number;
  dashboard: number;
}

export interface IntentStatusBreakdown {
  confirmed: number;
  cancelled: number;
  superseded: number;
}

export interface DepartureShift {
  /** Intentions in the window whose updated time actually differs from the plan. */
  changedCount: number;
  movedEarlier: number;
  movedLater: number;
  /** Average absolute shift in minutes across changed intentions, or null if none. */
  avgAbsoluteMinutes: number | null;
}

export interface ModeChange {
  /** Intentions linked to a journey, so the "usual" mode is known and comparable. */
  comparable: number;
  changed: number;
  /** 0-100, or null when nothing is comparable yet. */
  changeRate: number | null;
}

export interface IntentIntelligence {
  windowDays: number;
  totalIntentions: number;
  source: IntentSourceBreakdown;
  status: IntentStatusBreakdown;
  departureShift: DepartureShift;
  modeChange: ModeChange;
  /** True when the per-row scan hit ROW_SCAN_LIMIT — shift/mode figures are a sample, not exhaustive. */
  sampled: boolean;
}

export async function loadIntentIntelligence(cityCode: CityCode): Promise<IntentIntelligence> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const where = { cityCode, createdAt: { gte: since } };

  const [totalIntentions, chat, dashboard, confirmed, cancelled, superseded, rows] =
    await Promise.all([
      prisma.travelIntention.count({ where }),
      prisma.travelIntention.count({ where: { ...where, source: "CHAT" } }),
      prisma.travelIntention.count({ where: { ...where, source: "DASHBOARD" } }),
      prisma.travelIntention.count({ where: { ...where, status: "CONFIRMED" } }),
      prisma.travelIntention.count({ where: { ...where, status: "CANCELLED" } }),
      prisma.travelIntention.count({ where: { ...where, status: "SUPERSEDED" } }),
      prisma.travelIntention.findMany({
        where,
        take: ROW_SCAN_LIMIT,
        select: {
          plannedDeparture: true,
          updatedDeparture: true,
          transportMode: true,
          journey: { select: { mode: true } },
        },
      }),
    ]);

  let changedCount = 0;
  let movedEarlier = 0;
  let movedLater = 0;
  let absoluteMinuteTotal = 0;

  let comparable = 0;
  let modeChanged = 0;

  for (const row of rows) {
    const planned = toMinutes(row.plannedDeparture);
    const updated = toMinutes(row.updatedDeparture);
    if (planned !== null && updated !== null && planned !== updated) {
      changedCount += 1;
      absoluteMinuteTotal += Math.abs(updated - planned);
      if (updated < planned) movedEarlier += 1;
      else movedLater += 1;
    }

    if (row.journey) {
      comparable += 1;
      if (row.journey.mode !== row.transportMode) modeChanged += 1;
    }
  }

  return {
    windowDays: WINDOW_DAYS,
    totalIntentions,
    source: { chat, dashboard },
    status: { confirmed, cancelled, superseded },
    departureShift: {
      changedCount,
      movedEarlier,
      movedLater,
      avgAbsoluteMinutes:
        changedCount > 0 ? Math.round((absoluteMinuteTotal / changedCount) * 10) / 10 : null,
    },
    modeChange: {
      comparable,
      changed: modeChanged,
      changeRate: comparable > 0 ? Math.round((modeChanged / comparable) * 100) : null,
    },
    sampled: rows.length >= ROW_SCAN_LIMIT,
  };
}
