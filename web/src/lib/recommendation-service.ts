import type { Recommendation, TravelProfile } from "@prisma/client";

import { appDateOnly, appLocalDate, appMinutesSinceMidnight } from "@/lib/app-time";
import { getCity, type CityCode } from "@/lib/cities";
import { prisma } from "@/lib/db";
import {
  buildAdjustedCurve,
  demandAtFor,
  loadDemandContext,
  type AdjustedDemandSlot,
} from "@/lib/demand/aggregate";
import { DEMAND_LEVEL_LABEL, levelForIndex } from "@/lib/demand/demand-model";
import {
  peakStripRange,
  recommendDeparture,
  type RecommendationResult,
} from "@/lib/demand/recommend";
import { SLOT_MINUTES, toTimeString } from "@/lib/demand/time-slots";

/**
 * Ties the demand engine to the database.
 *
 * The dashboard (a server component) and the API routes both call in here, so
 * there is exactly one definition of "today's recommendation" in the product.
 *
 * FROM PHASE 3 the demand values used here are the ADJUSTED curve — the
 * baseline model plus everyone's confirmed departures plus any active network
 * event. See lib/demand/aggregate.ts.
 *
 * WHY THE RECOMMENDATION IS STORED
 * Two reasons, both about honesty:
 *  1. The reason text shown to the user is saved with it, so "why am I seeing
 *     this?" can be answered later with the actual wording they saw — not a
 *     sentence re-derived from numbers that have since moved.
 *  2. It gives a real recommendation history: what was suggested, what the
 *     person actually chose, day by day.
 */

export interface TodayView {
  /** Null until onboarding is finished. */
  profile: TravelProfile | null;
  /** Null when there is no profile yet. */
  recommendation: Recommendation | null;
  /** Freshly computed engine output — includes every option considered. */
  engine: RecommendationResult | null;
  /** Short demand strip around the usual departure, for the peak chart. */
  peakStrip: AdjustedDemandSlot[];
  /** Demand right now, for the "traffic status" tile. */
  now: AdjustedDemandSlot;
  cityCode: CityCode;
}

/**
 * Loads (and if needed creates) everything the dashboard needs for today.
 *
 * @param userId    The signed-in user.
 * @param cityCode  City to compute demand for. Falls back to the default city.
 */
export async function loadTodayForUser(
  userId: string,
  cityCode: string | null | undefined
): Promise<TodayView> {
  const city = getCity(cityCode);
  const localNow = appLocalDate();
  const travelDate = appDateOnly();

  // One database round trip for confirmed trips and network events, reused for
  // every slot the engine asks about.
  const context = await loadDemandContext(city.code, travelDate, localNow);

  const currentSlot =
    Math.floor(appMinutesSinceMidnight() / SLOT_MINUTES) * SLOT_MINUTES;
  const nowSlot = buildAdjustedCurve(context, currentSlot, currentSlot)[0] ?? {
    minutes: currentSlot,
    time: toTimeString(currentSlot),
    index: 0,
    level: levelForIndex(0),
    label: DEMAND_LEVEL_LABEL[levelForIndex(0)],
    baselineIndex: 0,
    confirmedTrips: 0,
    overCapacity: false,
  };

  const profile = await prisma.travelProfile.findUnique({ where: { userId } });

  // No routine yet: the dashboard sends them to onboarding instead.
  if (!profile) {
    return {
      profile: null,
      recommendation: null,
      engine: null,
      peakStrip: [],
      now: nowSlot,
      cityCode: city.code,
    };
  }

  // ------------------------------------------------------- run the engine
  const engine = recommendDeparture({
    demandAt: demandAtFor(context),
    usualDeparture: profile.usualDeparture,
    requiredArrival: profile.requiredArrival,
    typicalJourneyMinutes: profile.typicalJourneyMinutes,
    isFlexible: profile.isFlexible,
    flexibilityMinutes: profile.flexibilityMinutes,
    willingToLeaveEarlier: profile.willingToLeaveEarlier,
    willingToLeaveLater: profile.willingToLeaveLater,
  });

  const recommendation = await persistRecommendation({
    userId,
    cityCode: city.code,
    travelDate,
    engine,
  });

  // ----------------------------------------------------- demand around it
  const strip = peakStripRange(profile.usualDeparture);
  const peakStrip = buildAdjustedCurve(context, strip.from, strip.to);

  return {
    profile,
    recommendation,
    engine,
    peakStrip,
    now: nowSlot,
    cityCode: city.code,
  };
}

/**
 * Writes today's recommendation, or returns the one already stored.
 *
 * A stored recommendation is REPLACED only when it no longer describes the
 * user's situation — they changed their routine, switched city, or the
 * city-wide optimiser moved them. Otherwise it is left exactly as it was,
 * including whether they already accepted it.
 */
async function persistRecommendation(args: {
  userId: string;
  cityCode: CityCode;
  travelDate: Date;
  engine: RecommendationResult;
}): Promise<Recommendation> {
  const { userId, cityCode, travelDate, engine } = args;

  const existing = await prisma.recommendation.findUnique({
    where: { userId_travelDate: { userId, travelDate } },
  });

  // A recommendation the person has already acted on is never silently
  // rewritten underneath them — only the optimiser may change it, and when it
  // does it says so.
  if (existing && existing.status !== "PENDING") return existing;

  const stillAccurate =
    existing !== null &&
    existing.cityCode === cityCode &&
    existing.usualDeparture === engine.usualDeparture &&
    existing.recommendedDeparture === engine.recommendedDeparture;

  if (stillAccurate) return existing;

  return prisma.recommendation.upsert({
    where: { userId_travelDate: { userId, travelDate } },
    create: {
      userId,
      travelDate,
      cityCode,
      usualDeparture: engine.usualDeparture,
      recommendedDeparture: engine.recommendedDeparture,
      demandAtUsual: engine.demandAtUsual,
      demandAtRecommended: engine.demandAtRecommended,
      reason: engine.reason,
    },
    update: {
      cityCode,
      usualDeparture: engine.usualDeparture,
      recommendedDeparture: engine.recommendedDeparture,
      demandAtUsual: engine.demandAtUsual,
      demandAtRecommended: engine.demandAtRecommended,
      reason: engine.reason,
      // The situation changed, so any earlier decision no longer applies.
      status: "PENDING",
      chosenDeparture: null,
    },
  });
}

/** The last N days of recommendations, newest first. Used by the history card. */
export async function loadRecommendationHistory(
  userId: string,
  take = 10
): Promise<Recommendation[]> {
  return prisma.recommendation.findMany({
    where: { userId },
    orderBy: { travelDate: "desc" },
    take,
  });
}
