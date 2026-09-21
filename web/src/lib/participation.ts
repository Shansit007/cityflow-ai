import { prisma } from "@/lib/db";
import { aggregateSavings, estimateFuelLitres } from "@/lib/demand/savings";
import { toMinutes } from "@/lib/demand/time-slots";

/**
 * "My CityFlow participation" — what one person has actually contributed.
 *
 * ========================= THE HONESTY CONSTRAINT ===========================
 * It is very tempting to put "you saved 4.5 hours this month" on a page like
 * this. CityFlow AI cannot know that. Nobody's real journey was measured; the
 * demand figures are model output; and a person who left 15 minutes earlier may
 * have had a worse trip, not a better one.
 *
 * So every figure on this page is something the system genuinely observed:
 * how many days this person made a plan, how often they took a suggestion, how
 * far their departures moved, how many road issues they reported. Those are
 * facts. "Time saved" is not, and does not appear.
 * ============================================================================
 */

/**
 * "My CityFlow Impact" — the same honestly-estimated figures the Admin
 * Portal shows for the whole city (see `loadModelledImpact` and
 * `ESTIMATE_CAVEAT` in demand/savings.ts), computed for one person instead.
 *
 * Nothing here is a new kind of number. It is the exact same model —
 * light-traffic journey time versus the demand index at the accepted
 * departure — run over this person's own accepted recommendations instead of
 * the whole city's. `hasImpactData` is false, and the page shows nothing
 * rather than zeroes, until this person has actually accepted a
 * recommendation for a journey that has a stated light-traffic time.
 */
export interface PersonalImpact {
  hasImpactData: boolean;
  /** Confirmed travel plans — trips that went through the recommendation pipeline. */
  tripsOptimized: number;
  /** Times this person specifically took the suggested departure (not a custom one). */
  recommendedDeparturesFollowed: number;
  estimatedMinutesSaved: number;
  estimatedPersonHours: number;
  /** One sentence naming exactly where the time figure came from, for the most recent estimate. */
  savingsMethod: string | null;
  /** Confirmed or accepted trips that moved away from this person's usual time. */
  tripsShiftedAwayFromPeak: number;
  estimatedFuelLitres: number;
  fuelAssumptions: string[];
}

export interface ParticipationSummary {
  memberSince: Date;
  /** Days with a recommendation generated. */
  daysWithRecommendation: number;
  /** Days the person made an explicit decision rather than ignoring it. */
  daysDecided: number;
  timesAcceptedSuggestion: number;
  timesKeptUsualTime: number;
  timesChoseOwnTime: number;
  /** Confirmed travel plans, which is what feeds city demand. */
  plansConfirmed: number;
  tripsCancelled: number;
  /**
   * Total minutes this person's departures moved away from their usual time,
   * across every accepted or custom decision. A measure of flexibility offered,
   * NOT a measure of benefit.
   */
  totalMinutesShifted: number;
  /** How many days their recommendation was adjusted because others confirmed. */
  timesRecommendationAdjusted: number;
  roadIssuesReported: number;
  roadSensorDetections: number;
  /** Whether their trips are counted in city figures at all. */
  countedInCityFigures: boolean;
  personalImpact: PersonalImpact;
}

export async function loadParticipationSummary(
  userId: string
): Promise<ParticipationSummary> {
  const [user, profile, recommendations, intentions, roadReports] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    prisma.travelProfile.findUnique({
      where: { userId },
      select: { shareAggregatedDemand: true },
    }),
    prisma.recommendation.findMany({
      where: { userId },
      select: {
        status: true,
        usualDeparture: true,
        chosenDeparture: true,
        recommendedDeparture: true,
        updatedByOptimiser: true,
        demandAtUsual: true,
        demandAtRecommended: true,
        journey: { select: { typicalJourneyMinutes: true, mode: true } },
      },
    }),
    prisma.travelIntention.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true },
    }),
    prisma.roadIssueReport.groupBy({
      by: ["source"],
      where: { userId },
      _count: { _all: true },
    }),
  ]);

  let timesAcceptedSuggestion = 0;
  let timesKeptUsualTime = 0;
  let timesChoseOwnTime = 0;
  let totalMinutesShifted = 0;
  let timesRecommendationAdjusted = 0;

  for (const row of recommendations) {
    if (row.updatedByOptimiser) timesRecommendationAdjusted += 1;

    if (row.status === "ACCEPTED") timesAcceptedSuggestion += 1;
    if (row.status === "KEPT_USUAL") timesKeptUsualTime += 1;
    if (row.status === "CUSTOM") timesChoseOwnTime += 1;

    /*
      Shift is measured against the person's own usual time, using the time they
      actually settled on. `chosenDeparture` is only set once they decide, so a
      recommendation they never answered contributes nothing — which is right:
      an unanswered suggestion moved nobody.
    */
    const settled =
      row.status === "ACCEPTED"
        ? row.recommendedDeparture
        : row.status === "CUSTOM"
          ? row.chosenDeparture
          : null;

    if (settled) {
      const usual = toMinutes(row.usualDeparture);
      const actual = toMinutes(settled);
      if (usual !== null && actual !== null) {
        totalMinutesShifted += Math.abs(actual - usual);
      }
    }
  }

  /*
    Personal impact: the same estimate the Admin Portal computes city-wide,
    run over this one person's ACCEPTED recommendations that have a journey
    with a stated light-traffic time. A recommendation whose journey was since
    deleted contributes nothing, rather than a guessed number.
  */
  const acceptedWithJourney = recommendations.filter(
    (row) => row.status === "ACCEPTED" && row.journey !== null
  );

  const personalSavings = aggregateSavings(
    acceptedWithJourney.map((row) => ({
      typicalJourneyMinutes: row.journey!.typicalJourneyMinutes,
      demandAtUsual: row.demandAtUsual,
      demandAtRecommended: row.demandAtRecommended,
    }))
  );

  const personalVehicleTrips = acceptedWithJourney.filter(
    (row) => row.journey!.mode === "CAR" || row.journey!.mode === "BIKE"
  ).length;
  const personalVehicleShare =
    acceptedWithJourney.length === 0 ? 0 : personalVehicleTrips / acceptedWithJourney.length;

  const personalFuel = estimateFuelLitres(personalSavings.totalMinutes, personalVehicleShare);

  const lastAccepted = acceptedWithJourney[acceptedWithJourney.length - 1];
  const savingsMethod = lastAccepted
    ? `Your ${lastAccepted.journey!.typicalJourneyMinutes}-minute light-traffic journey is modelled at fewer minutes when demand is lower at the time you left.`
    : null;

  /*
    Prisma's groupBy gives one row per distinct value. These two helpers pull a
    single row's count out of that, defaulting to 0 — a status nobody has used
    simply has no row, which is not the same as an error.
  */
  const intentionCount = (status: string) =>
    intentions.find((row) => row.status === status)?._count._all ?? 0;

  const roadReportCount = (source: string) =>
    roadReports.find((row) => row.source === source)?._count._all ?? 0;

  return {
    memberSince: user?.createdAt ?? new Date(),
    daysWithRecommendation: recommendations.length,
    daysDecided: timesAcceptedSuggestion + timesKeptUsualTime + timesChoseOwnTime,
    timesAcceptedSuggestion,
    timesKeptUsualTime,
    timesChoseOwnTime,
    plansConfirmed: intentionCount("CONFIRMED"),
    tripsCancelled: intentionCount("CANCELLED"),
    totalMinutesShifted,
    timesRecommendationAdjusted,
    roadIssuesReported: roadReportCount("CITIZEN_REPORT"),
    roadSensorDetections: roadReportCount("SENSOR_DETECTION"),
    countedInCityFigures: profile?.shareAggregatedDemand ?? false,
    personalImpact: {
      hasImpactData: acceptedWithJourney.length > 0,
      tripsOptimized: intentionCount("CONFIRMED"),
      recommendedDeparturesFollowed: timesAcceptedSuggestion,
      estimatedMinutesSaved: personalSavings.totalMinutes,
      estimatedPersonHours: personalSavings.personHours,
      savingsMethod,
      tripsShiftedAwayFromPeak: timesAcceptedSuggestion + timesChoseOwnTime,
      estimatedFuelLitres: personalFuel.litres,
      fuelAssumptions: personalFuel.assumptions,
    },
  };
}
