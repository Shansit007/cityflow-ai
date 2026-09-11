import type { CityCode } from "@/lib/cities";
import { prisma } from "@/lib/db";
import { busiestZoneTrips, loadZoneTripTotals } from "@/lib/demand/zone-trips";
import { toZoneKey, zoneKeyToLabel } from "@/lib/demand/zones";
import { cellIsPrecise, cellKeyFor, isPlausibleCoordinate } from "@/lib/roads/cell";
import { confidenceFor, evidenceProgressSentence } from "@/lib/roads/confidence";
import { priorityBand, scorePriority, type PriorityBreakdown } from "@/lib/roads/priority";
import type {
  RoadIssueConfidence,
  RoadIssueSeverity,
  RoadIssueSource,
  RoadIssueType,
} from "@/lib/roads/types";

/**
 * Everything that reads or writes road-condition data.
 *
 * ============================== THE BOUNDARY ================================
 * CityFlow AI collects possible road problems, merges duplicates, works out how
 * much evidence there is, and ranks them by how many people they affect. It
 * then hands that list to the Municipal Dashboard.
 *
 * It does NOT: schedule an inspection, assign a crew, record a repair, or track
 * a status beyond "we have handed this over". There is deliberately no function
 * in this file that could do any of those things. The Municipal Dashboard is a
 * separate system and owns that workflow entirely.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- */
/*  Writing                                                                    */
/* -------------------------------------------------------------------------- */

export interface RoadReportInput {
  cityCode: CityCode;
  /** Free-text area, e.g. "Salt Lake Sector 5". */
  areaLabel: string;
  issueType: RoadIssueType;
  severity: RoadIssueSeverity;
  description?: string | null;
  photo?: string | null;
  lat?: number | null;
  lng?: number | null;
  source: RoadIssueSource;
  /** Peak vertical acceleration for a sensor detection, m/s². */
  impactMagnitude?: number | null;
}

export type SubmitOutcome =
  | { result: "created"; issueId: string; confidence: RoadIssueConfidence; reportCount: number }
  | { result: "merged"; issueId: string; confidence: RoadIssueConfidence; reportCount: number }
  | { result: "already-reported"; issueId: string; confidence: RoadIssueConfidence; reportCount: number };

/**
 * Records one report and returns what happened to it.
 *
 * THREE OUTCOMES, AND WHY EACH MATTERS TO THE PERSON
 *   created           — nobody had reported this spot before; they are first.
 *   merged            — it joins existing reports and raises the evidence.
 *   already-reported  — this person already reported this exact issue, so the
 *                       count does not move. Saying so is more honest than
 *                       silently accepting it and pretending it counted.
 *
 * The last case is also the anti-inflation rule: the unique constraint on
 * (roadIssueId, userId) means one person can never be twenty pieces of
 * evidence, no matter how many times they press the button.
 */
export async function submitRoadReport(
  userId: string,
  input: RoadReportInput
): Promise<SubmitOutcome> {
  const zoneKey = toZoneKey(input.areaLabel);

  const lat =
    typeof input.lat === "number" && typeof input.lng === "number" &&
    isPlausibleCoordinate(input.lat, input.lng)
      ? input.lat
      : null;
  const lng = lat === null ? null : input.lng!;

  const cellKey = cellKeyFor({ cityCode: input.cityCode, zoneKey, lat, lng });

  // Find or create the issue this report belongs to.
  const existing = await prisma.roadIssue.findUnique({
    where: { cellKey_issueType: { cellKey, issueType: input.issueType } },
    select: { id: true },
  });

  let issueId: string;
  let created = false;

  if (existing) {
    issueId = existing.id;
  } else {
    const issue = await prisma.roadIssue.create({
      data: {
        cityCode: input.cityCode,
        zoneKey,
        areaLabel: input.areaLabel.trim().slice(0, 80) || zoneKeyToLabel(zoneKey),
        lat,
        lng,
        cellKey,
        issueType: input.issueType,
        severity: input.severity,
        // Counts are set properly by the recount below; these are just the seed.
        reportCount: 0,
        sensorReportCount: 0,
      },
      select: { id: true },
    });
    issueId = issue.id;
    created = true;
  }

  /*
    One report per person per issue. `createMany` with skipDuplicates lets the
    database enforce that rather than a read-then-write, which would have a race
    between two tabs.
  */
  const inserted = await prisma.roadIssueReport.createMany({
    data: [
      {
        roadIssueId: issueId,
        userId,
        source: input.source,
        description: input.description?.trim().slice(0, 500) || null,
        photo: input.photo ?? null,
        impactMagnitude: input.impactMagnitude ?? null,
      },
    ],
    skipDuplicates: true,
  });

  const wasNew = inserted.count > 0;

  // A repeat press must not raise the severity either — otherwise the anti-
  // inflation rule would be trivially bypassed by re-reporting as "dangerous".
  if (wasNew && !created) {
    await raiseSeverityIfWorse(issueId, input.severity);
  }

  const state = await recountIssue(issueId);

  if (created) return { result: "created", issueId, ...state };
  return { result: wasNew ? "merged" : "already-reported", issueId, ...state };
}

/**
 * The severity stored on an issue is the WORST anybody has reported.
 *
 * Averaging would be wrong here in a way that matters: if nine people say a
 * pothole is minor and one says it broke their wheel, the road is dangerous.
 * Under-stating a hazard is a much worse failure than over-stating one, so the
 * maximum is the honest choice.
 */
async function raiseSeverityIfWorse(issueId: string, reported: RoadIssueSeverity) {
  const RANK: Record<RoadIssueSeverity, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

  const issue = await prisma.roadIssue.findUnique({
    where: { id: issueId },
    select: { severity: true },
  });
  if (!issue) return;

  if (RANK[reported] > RANK[issue.severity as RoadIssueSeverity]) {
    await prisma.roadIssue.update({
      where: { id: issueId },
      data: { severity: reported },
    });
  }
}

/**
 * Recomputes an issue's counts, confidence and priority from its reports.
 *
 * Derived values are never incremented in place — they are recalculated from
 * the rows that justify them. That costs one extra query and buys the guarantee
 * that a failed request, a retry or a deleted report can never leave an issue
 * claiming evidence it does not have.
 */
async function recountIssue(issueId: string): Promise<{
  confidence: RoadIssueConfidence;
  reportCount: number;
}> {
  const issue = await prisma.roadIssue.findUnique({
    where: { id: issueId },
    select: { cityCode: true, zoneKey: true, severity: true },
  });
  if (!issue) return { confidence: "POSSIBLE", reportCount: 0 };

  const [reportCount, sensorReportCount, latest] = await Promise.all([
    prisma.roadIssueReport.count({ where: { roadIssueId: issueId } }),
    prisma.roadIssueReport.count({
      where: { roadIssueId: issueId, source: "SENSOR_DETECTION" },
    }),
    prisma.roadIssueReport.findFirst({
      where: { roadIssueId: issueId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const confidence = confidenceFor(reportCount, sensorReportCount);

  const zoneTotals = await loadZoneTripTotals(issue.cityCode as CityCode);
  const priority = scorePriority({
    reportCount,
    sensorReportCount,
    severity: issue.severity as RoadIssueSeverity,
    zoneTrips: zoneTotals.get(issue.zoneKey) ?? 0,
    busiestZoneTrips: busiestZoneTrips(zoneTotals),
  });

  await prisma.roadIssue.update({
    where: { id: issueId },
    data: {
      reportCount,
      sensorReportCount,
      confidence,
      priorityScore: priority.score,
      lastReportedAt: latest?.createdAt ?? new Date(),
    },
  });

  return { confidence, reportCount };
}

/* -------------------------------------------------------------------------- */
/*  Reading — for the person                                                   */
/* -------------------------------------------------------------------------- */

export interface RoadIssueView {
  id: string;
  areaLabel: string;
  zoneKey: string;
  lat: number | null;
  lng: number | null;
  issueType: RoadIssueType;
  severity: RoadIssueSeverity;
  confidence: RoadIssueConfidence;
  reportCount: number;
  sensorReportCount: number;
  priorityScore: number;
  priorityBand: "low" | "medium" | "high";
  preciseLocation: boolean;
  handedOverAt: Date | null;
  firstReportedAt: Date;
  lastReportedAt: Date;
  /** "2 more reports would make this likely", or null at the top level. */
  progressSentence: string | null;
  /** Whether the signed-in person is one of the reporters. */
  reportedByMe: boolean;
}

/**
 * Road issues relevant to one person: everything in their home area, plus
 * everything in their destination area.
 *
 * Those two areas are what the person actually travels between, so they are the
 * roads they can do something about — and the ones a warning is worth showing
 * for. A city-wide list would bury both.
 */
export async function loadIssuesForUser(options: {
  userId: string;
  cityCode: CityCode;
  homeArea: string;
  destinationArea: string;
}): Promise<RoadIssueView[]> {
  const zoneKeys = [toZoneKey(options.homeArea), toZoneKey(options.destinationArea)];

  const issues = await prisma.roadIssue.findMany({
    where: { cityCode: options.cityCode, zoneKey: { in: zoneKeys } },
    orderBy: [{ priorityScore: "desc" }, { lastReportedAt: "desc" }],
    take: 40,
    include: {
      reports: {
        where: { userId: options.userId },
        select: { id: true },
        take: 1,
      },
    },
  });

  return issues.map((issue) => toView(issue, issue.reports.length > 0));
}

/** Every report this person has made, so they can see their own contribution. */
export async function loadMyRoadReports(userId: string) {
  return prisma.roadIssueReport.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      source: true,
      description: true,
      createdAt: true,
      roadIssue: {
        select: {
          id: true,
          areaLabel: true,
          issueType: true,
          severity: true,
          confidence: true,
          reportCount: true,
          sensorReportCount: true,
        },
      },
    },
  });
}

/** Shared mapping so every screen describes an issue identically. */
function toView(
  issue: {
    id: string;
    areaLabel: string;
    zoneKey: string;
    lat: number | null;
    lng: number | null;
    cellKey: string;
    issueType: string;
    severity: string;
    confidence: string;
    reportCount: number;
    sensorReportCount: number;
    priorityScore: number;
    handedOverAt: Date | null;
    firstReportedAt: Date;
    lastReportedAt: Date;
  },
  reportedByMe: boolean
): RoadIssueView {
  return {
    id: issue.id,
    areaLabel: issue.areaLabel,
    zoneKey: issue.zoneKey,
    lat: issue.lat,
    lng: issue.lng,
    issueType: issue.issueType as RoadIssueType,
    severity: issue.severity as RoadIssueSeverity,
    confidence: issue.confidence as RoadIssueConfidence,
    reportCount: issue.reportCount,
    sensorReportCount: issue.sensorReportCount,
    priorityScore: issue.priorityScore,
    priorityBand: priorityBand(issue.priorityScore),
    preciseLocation: cellIsPrecise(issue.cellKey),
    handedOverAt: issue.handedOverAt,
    firstReportedAt: issue.firstReportedAt,
    lastReportedAt: issue.lastReportedAt,
    progressSentence: evidenceProgressSentence(issue.reportCount, issue.sensorReportCount),
    reportedByMe,
  };
}

/* -------------------------------------------------------------------------- */
/*  Reading — for the Admin Portal                                             */
/* -------------------------------------------------------------------------- */

export interface RoadConditionSummary {
  totalIssues: number;
  byConfidence: Record<RoadIssueConfidence, number>;
  bySeverity: Record<RoadIssueSeverity, number>;
  byType: Array<{ type: RoadIssueType; count: number }>;
  /** Areas with the most issues, worst first. */
  topZones: Array<{ zoneKey: string; zoneLabel: string; count: number; trips: number }>;
  /** The highest-priority issues, for the hand-off list. */
  priorityList: RoadIssueView[];
  handedOver: number;
  awaitingHandover: number;
  sensorDetections: number;
  citizenReports: number;
  lastReportAt: Date | null;
}

/**
 * Aggregated road-condition monitoring for the Admin Portal.
 *
 * PRIVACY: this returns issues and counts. It never selects a reporter's user
 * id, and `RoadIssueReport` is not joined at all — the only per-report figure
 * that reaches the portal is how many there were.
 */
export async function loadRoadConditionSummary(
  cityCode: CityCode
): Promise<RoadConditionSummary> {
  const [issues, zoneTotals] = await Promise.all([
    prisma.roadIssue.findMany({
      where: { cityCode },
      orderBy: [{ priorityScore: "desc" }, { lastReportedAt: "desc" }],
      take: 500,
    }),
    loadZoneTripTotals(cityCode),
  ]);

  const byConfidence: Record<RoadIssueConfidence, number> = {
    POSSIBLE: 0,
    LIKELY: 0,
    CONFIRMED_BY_REPORTS: 0,
  };
  const bySeverity: Record<RoadIssueSeverity, number> = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  const typeCounts = new Map<string, number>();
  const zoneCounts = new Map<string, number>();

  let handedOver = 0;
  let sensorDetections = 0;
  let citizenReports = 0;
  let lastReportAt: Date | null = null;

  for (const issue of issues) {
    byConfidence[issue.confidence as RoadIssueConfidence] += 1;
    bySeverity[issue.severity as RoadIssueSeverity] += 1;
    typeCounts.set(issue.issueType, (typeCounts.get(issue.issueType) ?? 0) + 1);
    zoneCounts.set(issue.zoneKey, (zoneCounts.get(issue.zoneKey) ?? 0) + 1);

    if (issue.handedOverAt) handedOver += 1;
    sensorDetections += issue.sensorReportCount;
    citizenReports += Math.max(0, issue.reportCount - issue.sensorReportCount);

    if (!lastReportAt || issue.lastReportedAt > lastReportAt) {
      lastReportAt = issue.lastReportedAt;
    }
  }

  return {
    totalIssues: issues.length,
    byConfidence,
    bySeverity,
    byType: [...typeCounts.entries()]
      .map(([type, count]) => ({ type: type as RoadIssueType, count }))
      .sort((a, b) => b.count - a.count),
    topZones: [...zoneCounts.entries()]
      .map(([zoneKey, count]) => ({
        zoneKey,
        zoneLabel: zoneKeyToLabel(zoneKey),
        count,
        trips: zoneTotals.get(zoneKey) ?? 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    priorityList: issues.slice(0, 25).map((issue) => toView(issue, false)),
    handedOver,
    awaitingHandover: issues.length - handedOver,
    sensorDetections,
    citizenReports,
    lastReportAt,
  };
}

/* -------------------------------------------------------------------------- */
/*  The Municipal Dashboard hand-off                                           */
/* -------------------------------------------------------------------------- */

export interface HandoffIssue {
  reference: string;
  city: string;
  area: string;
  location: { lat: number; lng: number } | null;
  locationPrecision: "approximate-gps" | "area-only";
  issueType: RoadIssueType;
  reportedSeverity: RoadIssueSeverity;
  evidence: {
    confidence: RoadIssueConfidence;
    independentReports: number;
    ofWhichSensorDetections: number;
  };
  suggestedPriority: {
    score: number;
    band: "low" | "medium" | "high";
    evidenceComponent: number;
    severityComponent: number;
    exposureComponent: number;
    tripsThroughAreaPerDay: number;
    explanation: string;
  };
  firstReported: string;
  lastReported: string;
}

export interface HandoffPayload {
  producedBy: string;
  producedAt: string;
  city: string;
  /** Read this before using the file. It is part of the payload on purpose. */
  notice: string[];
  scoring: Record<string, string>;
  issueCount: number;
  issues: HandoffIssue[];
}

/**
 * Builds the file the Municipal Dashboard consumes.
 *
 * WHY THE CAVEATS TRAVEL INSIDE THE FILE
 * A hand-off file outlives the conversation that produced it. Somebody will
 * open this six months from now with no memory of how the numbers were made,
 * and the difference between "confirmed by reports" and "inspected and
 * verified" is exactly the kind of thing that gets lost in that gap — with real
 * consequences, because a municipal team could reasonably act on the stronger
 * reading. So the caveats are a field in the payload, not a line in a README.
 *
 * PRIVACY: no reporter identity of any kind is included. The payload is
 * locations, categories, counts and a score.
 */
export async function buildHandoffPayload(
  cityCode: CityCode,
  cityName: string
): Promise<{ payload: HandoffPayload; issueIds: string[] }> {
  const [issues, zoneTotals] = await Promise.all([
    prisma.roadIssue.findMany({
      where: { cityCode },
      orderBy: [{ priorityScore: "desc" }, { lastReportedAt: "desc" }],
      take: 500,
    }),
    loadZoneTripTotals(cityCode),
  ]);

  const busiest = busiestZoneTrips(zoneTotals);

  const handoffIssues: HandoffIssue[] = issues.map((issue) => {
    const zoneTrips = zoneTotals.get(issue.zoneKey) ?? 0;

    const breakdown: PriorityBreakdown = scorePriority({
      reportCount: issue.reportCount,
      sensorReportCount: issue.sensorReportCount,
      severity: issue.severity as RoadIssueSeverity,
      zoneTrips,
      busiestZoneTrips: busiest,
    });

    return {
      // A short, stable reference the municipal team can quote back to us.
      reference: `CF-RD-${issue.id.slice(-8).toUpperCase()}`,
      city: cityName,
      area: issue.areaLabel,
      location:
        issue.lat !== null && issue.lng !== null
          ? { lat: issue.lat, lng: issue.lng }
          : null,
      locationPrecision: cellIsPrecise(issue.cellKey) ? "approximate-gps" : "area-only",
      issueType: issue.issueType as RoadIssueType,
      reportedSeverity: issue.severity as RoadIssueSeverity,
      evidence: {
        confidence: issue.confidence as RoadIssueConfidence,
        independentReports: issue.reportCount,
        ofWhichSensorDetections: issue.sensorReportCount,
      },
      suggestedPriority: {
        score: breakdown.score,
        band: priorityBand(breakdown.score),
        evidenceComponent: breakdown.evidence,
        severityComponent: breakdown.severity,
        exposureComponent: breakdown.exposure,
        tripsThroughAreaPerDay: zoneTrips,
        explanation: breakdown.explanation,
      },
      firstReported: issue.firstReportedAt.toISOString(),
      lastReported: issue.lastReportedAt.toISOString(),
    };
  });

  const payload: HandoffPayload = {
    producedBy: "CityFlow AI",
    producedAt: new Date().toISOString(),
    city: cityName,
    notice: [
      "These are POSSIBLE road issues reported by citizens and detected by phone motion sensors. None of them has been inspected.",
      "\"Confirmed by multiple reports\" means independent reporters agree. It does NOT mean a defect has been verified on the ground.",
      "Locations marked 'approximate-gps' come from consumer phone GPS and can be 5-30 metres out. Locations marked 'area-only' have no coordinates at all and identify a neighbourhood, not a spot.",
      "The suggested priority is advisory. It weighs evidence, reported severity and how many CityFlow AI trips pass through the area. It cannot see school routes, hospital approaches, existing works or local commitments, so the municipal authority's own ordering should override it.",
      "Trip counts come from registered CityFlow AI users only and are not a traffic census.",
      "No reporter identity is included in this file, by design.",
    ],
    scoring: {
      formula: "score = 0.3 x evidence + 0.4 x severity + 0.3 x exposure, each component 0-100",
      evidence: "Weighted independent reports; a phone detection counts half a human report; saturates at 8.",
      severity: "Worst severity anybody reported: minor 25, moderate 60, dangerous 100.",
      exposure: "Trips through the area as a percentage of the busiest area in the same city.",
    },
    issueCount: handoffIssues.length,
    issues: handoffIssues,
  };

  /*
    The database ids are returned ALONGSIDE the payload rather than inside it.
    The municipal team needs a reference they can quote, not our primary keys,
    and the caller needs the ids to stamp exactly the rows that made it into
    this file — so the two live in different places on purpose.
  */
  return { payload, issueIds: issues.map((issue) => issue.id) };
}

/**
 * Records that a set of issues has been handed over.
 *
 * This is the ONLY status this system keeps, and it means precisely one thing:
 * "this appeared in a file we gave the municipal team". It is not a repair
 * status and must never be displayed as one — CityFlow AI has no way of knowing
 * whether anything was fixed, and inventing a status would put a false picture
 * of the city's roads in front of citizens.
 */
export async function markHandedOver(cityCode: CityCode, issueIds: string[]): Promise<number> {
  if (issueIds.length === 0) return 0;

  const result = await prisma.roadIssue.updateMany({
    where: { cityCode, id: { in: issueIds } },
    data: { handedOverAt: new Date() },
  });

  return result.count;
}

/** Whether any road data exists at all, used for honest empty states. */
export async function countRoadIssues(cityCode: CityCode): Promise<number> {
  return prisma.roadIssue.count({ where: { cityCode } });
}
