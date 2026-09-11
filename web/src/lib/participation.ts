import { prisma } from "@/lib/db";
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
  };
}
