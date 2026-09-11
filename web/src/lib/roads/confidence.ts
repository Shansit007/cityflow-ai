import type { RoadIssueConfidence } from "@/lib/roads/types";

/**
 * How a pile of reports becomes a confidence level.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE
 * One report is never enough to call something real. The product principle is
 * that a detection is a "possible road issue" until several independent people
 * or phones agree, and this is the only place that decision is made — so it
 * cannot be quietly softened somewhere in a component.
 *
 * WHY SENSOR REPORTS COUNT FOR LESS
 * A phone jolt and a person stopping to fill in a form are not equal evidence.
 * The jolt could be a speed breaker, a kerb, a pothole, or the phone sliding off
 * the seat. A person choosing "pothole", writing a sentence and attaching a
 * photo has actually looked at the thing. So a human report carries full weight
 * and a sensor detection carries half. That ratio is a judgement, not a
 * measurement, and it is written here in one line so it can be revised against
 * real data instead of being buried.
 */

/** A citizen report counts as one whole piece of evidence. */
export const HUMAN_REPORT_WEIGHT = 1;

/** A phone detection counts for half — it is a hint, not an observation. */
export const SENSOR_REPORT_WEIGHT = 0.5;

/** Weighted evidence needed to move up a level. */
export const LIKELY_THRESHOLD = 3;
export const CONFIRMED_THRESHOLD = 6;

/**
 * Weighted evidence for an issue.
 *
 * @param reportCount        total independent reports
 * @param sensorReportCount  how many of those came from phone sensors
 */
export function evidenceScore(reportCount: number, sensorReportCount: number): number {
  const sensors = Math.min(sensorReportCount, reportCount);
  const humans = Math.max(0, reportCount - sensors);

  return humans * HUMAN_REPORT_WEIGHT + sensors * SENSOR_REPORT_WEIGHT;
}

/** Turns evidence into the confidence level stored on the issue. */
export function confidenceFor(
  reportCount: number,
  sensorReportCount: number
): RoadIssueConfidence {
  const score = evidenceScore(reportCount, sensorReportCount);

  if (score >= CONFIRMED_THRESHOLD) return "CONFIRMED_BY_REPORTS";
  if (score >= LIKELY_THRESHOLD) return "LIKELY";
  return "POSSIBLE";
}

/**
 * A plain-language sentence explaining how many more reports would move this
 * issue up a level. Shown to users so the confidence label is not a black box —
 * and so somebody who has seen the same pothole knows their report matters.
 *
 * Returns null once the issue is already at the top level.
 */
export function evidenceProgressSentence(
  reportCount: number,
  sensorReportCount: number
): string | null {
  const score = evidenceScore(reportCount, sensorReportCount);

  if (score >= CONFIRMED_THRESHOLD) return null;

  const target = score >= LIKELY_THRESHOLD ? CONFIRMED_THRESHOLD : LIKELY_THRESHOLD;
  const nextLabel = score >= LIKELY_THRESHOLD ? "confirmed by multiple reports" : "likely";

  const remaining = Math.max(1, Math.ceil(target - score));

  return `${remaining} more report${remaining === 1 ? "" : "s"} from other people would make this ${nextLabel}.`;
}
