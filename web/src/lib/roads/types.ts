/**
 * Road-condition vocabulary.
 *
 * Single source of truth for what a road issue can be, how bad it can be, and
 * how the three confidence levels are described to a human. The database enums
 * in `prisma/schema.prisma` mirror these lists; if you add a value, add it in
 * both places.
 *
 * The wording here is deliberate and is the reason this file exists rather than
 * strings being scattered through the UI. CityFlow AI never tells anybody that
 * a pothole *is* there — it says how much evidence there is that one might be.
 */

export const ROAD_ISSUE_TYPES = [
  {
    code: "POTHOLE",
    label: "Pothole",
    hint: "A hole or broken patch in the road surface",
  },
  {
    code: "BROKEN_SURFACE",
    label: "Broken or uneven surface",
    hint: "Cracked, sunken or badly patched road over a stretch",
  },
  {
    code: "WATERLOGGING",
    label: "Waterlogging",
    hint: "Water collects here and hides what is underneath",
  },
  {
    code: "UNMARKED_SPEED_BREAKER",
    label: "Unmarked speed breaker",
    hint: "A speed breaker with no paint or warning sign",
  },
  {
    code: "DEBRIS_OR_OBSTRUCTION",
    label: "Debris or obstruction",
    hint: "Rubble, construction material or something blocking a lane",
  },
  {
    code: "OPEN_MANHOLE",
    label: "Open or sunken manhole",
    hint: "A manhole cover missing, broken or below road level",
  },
  {
    code: "POOR_STREET_LIGHTING",
    label: "Poor street lighting",
    hint: "The stretch is unlit or badly lit after dark",
  },
  {
    code: "OTHER",
    label: "Something else",
    hint: "Describe it in your own words below",
  },
] as const;

export type RoadIssueType = (typeof ROAD_ISSUE_TYPES)[number]["code"];

export const ROAD_ISSUE_SEVERITIES = [
  {
    code: "LOW",
    label: "Minor",
    hint: "Noticeable, but you do not really have to slow down",
  },
  {
    code: "MEDIUM",
    label: "Moderate",
    hint: "Most people slow down or move around it",
  },
  {
    code: "HIGH",
    label: "Dangerous",
    hint: "Could damage a vehicle or make someone fall",
  },
] as const;

export type RoadIssueSeverity = (typeof ROAD_ISSUE_SEVERITIES)[number]["code"];

export type RoadIssueConfidence = "POSSIBLE" | "LIKELY" | "CONFIRMED_BY_REPORTS";

export type RoadIssueSource = "CITIZEN_REPORT" | "SENSOR_DETECTION";

/**
 * How each confidence level is described to a person.
 *
 * Note what the strongest level does NOT say. "Confirmed by reports" is a claim
 * about agreement between reporters. "Verified" would be a claim about a defect
 * existing, and only somebody who has gone and looked can make that one.
 */
export const CONFIDENCE_META: Record<
  RoadIssueConfidence,
  { label: string; sentence: string; tone: "moderate" | "high" | "severe" }
> = {
  POSSIBLE: {
    label: "Possible road issue",
    sentence:
      "Reported once. It has not been checked by anyone else yet, so treat it as a possibility rather than a fact.",
    tone: "moderate",
  },
  LIKELY: {
    label: "Likely road issue",
    sentence:
      "Several independent reports point at the same place, which makes it considerably more likely to be real.",
    tone: "high",
  },
  CONFIRMED_BY_REPORTS: {
    label: "Confirmed by multiple reports",
    sentence:
      "Many independent reports agree. This has still not been inspected — only the municipal authority can verify a defect on the ground.",
    tone: "severe",
  },
};

export const SOURCE_META: Record<RoadIssueSource, { label: string; sentence: string }> = {
  CITIZEN_REPORT: {
    label: "Reported by a person",
    sentence: "Somebody deliberately filled in a report about this place.",
  },
  SENSOR_DETECTION: {
    label: "Detected by phone sensors",
    sentence:
      "A phone recorded a sharp jolt here while travelling. That is a hint, not proof — a speed breaker or a kerb produces the same reading.",
  },
};

/** Lookup helpers that never throw, so unknown values cannot crash a page. */
export function issueTypeLabel(code: string): string {
  return ROAD_ISSUE_TYPES.find((type) => type.code === code)?.label ?? "Road issue";
}

export function severityLabel(code: string): string {
  return ROAD_ISSUE_SEVERITIES.find((level) => level.code === code)?.label ?? "Moderate";
}

export function confidenceMeta(code: string) {
  return CONFIDENCE_META[code as RoadIssueConfidence] ?? CONFIDENCE_META.POSSIBLE;
}
