import { evidenceScore } from "@/lib/roads/confidence";
import type { RoadIssueSeverity } from "@/lib/roads/types";

/**
 * Priority scoring for the Municipal Dashboard hand-off.
 *
 * WHY CITYFLOW AI SCORES THIS AT ALL
 * A municipal team has more reported problems than it can inspect this week, so
 * something has to decide what goes to the top of the list. CityFlow AI happens
 * to know one thing an ordinary complaints inbox does not: **how many people
 * actually travel through that area**. A dangerous pothole on a road 400 trips
 * pass through every morning affects far more people than an identical pothole
 * on a quiet lane. That is the contribution this file makes, and it is the only
 * reason a traffic-demand system should have an opinion about road repairs.
 *
 * WHERE THE AUTHORITY STOPS
 * This produces a *suggested order*. The municipal authority decides what to
 * inspect and repair, and their priorities include things this system cannot
 * see — a school route, a hospital approach, a contract already in progress,
 * this morning's political reality. So the hand-off file carries the score, the
 * three components behind it, and an explicit note that it is advisory.
 *
 * THE THREE COMPONENTS (each 0-100, then weighted)
 *   evidence  — how sure we are anything is there at all
 *   severity  — how bad it is if it is there
 *   exposure  — how many trips pass through the area
 *
 * The weights are a judgement about what a road-maintenance team cares about.
 * They are constants here, not magic numbers in the middle of a query, so they
 * can be argued about and changed in one place.
 */

export const WEIGHT_EVIDENCE = 0.3;
export const WEIGHT_SEVERITY = 0.4;
export const WEIGHT_EXPOSURE = 0.3;

/** Evidence beyond this many weighted reports adds nothing more. */
const EVIDENCE_SATURATION = 8;

const SEVERITY_SCORE: Record<RoadIssueSeverity, number> = {
  LOW: 25,
  MEDIUM: 60,
  HIGH: 100,
};

export interface PriorityInput {
  reportCount: number;
  sensorReportCount: number;
  severity: RoadIssueSeverity;
  /** Trips per day passing through this issue's zone, from the demand data. */
  zoneTrips: number;
  /** The busiest zone in the city, used to scale exposure fairly. */
  busiestZoneTrips: number;
}

export interface PriorityBreakdown {
  score: number;
  evidence: number;
  severity: number;
  exposure: number;
  /** Plain-language justification, carried into the hand-off file. */
  explanation: string;
}

export function scorePriority(input: PriorityInput): PriorityBreakdown {
  const evidence = Math.min(
    100,
    Math.round((evidenceScore(input.reportCount, input.sensorReportCount) / EVIDENCE_SATURATION) * 100)
  );

  const severity = SEVERITY_SCORE[input.severity] ?? SEVERITY_SCORE.MEDIUM;

  /*
    Exposure is relative to the busiest zone in the same city rather than an
    absolute trip count. An absolute scale would make every issue in a small
    city look unimportant next to one in a large city, which is meaningless —
    the municipal team ranking this list only ever works within one city.
  */
  const exposure =
    input.busiestZoneTrips > 0
      ? Math.min(100, Math.round((input.zoneTrips / input.busiestZoneTrips) * 100))
      : 0;

  const score = Math.round(
    evidence * WEIGHT_EVIDENCE + severity * WEIGHT_SEVERITY + exposure * WEIGHT_EXPOSURE
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    evidence,
    severity,
    exposure,
    explanation: explain({ evidence, severity, exposure, zoneTrips: input.zoneTrips }),
  };
}

function explain(parts: {
  evidence: number;
  severity: number;
  exposure: number;
  zoneTrips: number;
}): string {
  const pieces: string[] = [];

  if (parts.severity >= 100) pieces.push("reported as dangerous");
  else if (parts.severity >= 60) pieces.push("reported as moderate");
  else pieces.push("reported as minor");

  if (parts.evidence >= 75) pieces.push("with strong agreement between reports");
  else if (parts.evidence >= 38) pieces.push("with several reports agreeing");
  else pieces.push("with limited evidence so far");

  if (parts.exposure >= 70) {
    pieces.push(`on one of the city's busiest corridors (${parts.zoneTrips} trips a day pass through this area)`);
  } else if (parts.exposure >= 30) {
    pieces.push(`on a moderately busy route (${parts.zoneTrips} trips a day)`);
  } else if (parts.zoneTrips > 0) {
    pieces.push(`on a quieter route (${parts.zoneTrips} trips a day)`);
  } else {
    pieces.push("in an area with no registered CityFlow AI trips, so exposure is unknown");
  }

  // Capitalise the first letter without disturbing the rest of the sentence.
  const sentence = pieces.join(", ") + ".";
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/** Bucket used for sorting and colouring, so "high priority" means one thing. */
export function priorityBand(score: number): "low" | "medium" | "high" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}
