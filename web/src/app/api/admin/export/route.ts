import { NextResponse } from "next/server";

import { getAdminOrNull } from "@/lib/auth/admin";
import {
  loadCityOverview,
  loadZoneDemand,
  REPORT_END_MINUTES,
  REPORT_START_MINUTES,
} from "@/lib/admin/analytics";
import { appDateKey } from "@/lib/app-time";
import { getCity, isCityCode } from "@/lib/cities";
import { formatSlotLabel, toTimeString } from "@/lib/demand/time-slots";
import { loadRoadConditionSummary } from "@/lib/roads/road-service";
import { CONFIDENCE_META, issueTypeLabel, severityLabel } from "@/lib/roads/types";

/**
 * GET /api/admin/export?report=<type>&city=<code>
 *
 * Downloads an Admin Portal report as CSV.
 *
 * PRIVACY: every report here is built from the same aggregation functions the
 * portal displays, which return counts only. There is no code path in this file
 * that could emit a user id, a CityFlow ID, an email or a home area — and a
 * person who switched off city-level counting is excluded upstream.
 */

export const runtime = "nodejs";

const REPORTS = [
  "daily-demand",
  "zone-demand",
  "recommendations",
  "participation",
  "mode-split",
  "road-conditions",
] as const;

type ReportId = (typeof REPORTS)[number];

function isReportId(value: string): value is ReportId {
  return (REPORTS as readonly string[]).includes(value);
}

/** Wraps a value so a comma or quote inside it cannot break the column layout. */
function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(header: string[], rows: Array<Array<string | number>>): string {
  return [
    header.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
    "",
  ].join("\n");
}

export async function GET(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const report = searchParams.get("report") ?? "";
  const cityParam = searchParams.get("city") ?? "";

  if (!isReportId(report)) {
    return NextResponse.json(
      { error: `Unknown report. Expected one of: ${REPORTS.join(", ")}` },
      { status: 400 }
    );
  }

  const city = getCity(isCityCode(cityParam) ? cityParam : undefined);
  const dateKey = appDateKey();

  try {
    let csv: string;

    switch (report) {
      case "daily-demand": {
        const overview = await loadCityOverview(city.code);
        csv = toCsv(
          [
            "slot_start",
            "slot_label",
            "baseline_index",
            "confirmed_trips",
            "adjusted_index",
            "demand_level",
            "over_capacity",
          ],
          overview.dayCurve.map((slot) => [
            toTimeString(slot.minutes),
            formatSlotLabel(slot.minutes),
            slot.baselineIndex,
            slot.confirmedTrips,
            slot.index,
            slot.label,
            slot.overCapacity ? "yes" : "no",
          ])
        );
        break;
      }

      case "zone-demand": {
        const zones = await loadZoneDemand(city.code);
        const rows: Array<Array<string | number>> = [];

        for (const row of zones.rows) {
          zones.slotMinutes.forEach((minutes, index) => {
            const trips = row.trips[index] ?? 0;
            // Only emit non-empty cells; a full grid of zeros is unreadable.
            if (trips > 0) {
              rows.push([row.zoneLabel, row.zoneKey, toTimeString(minutes), trips]);
            }
          });
        }

        csv = toCsv(["zone", "zone_key", "slot_start", "trips"], rows);
        break;
      }

      case "recommendations": {
        const { recommendations } = await loadCityOverview(city.code);
        csv = toCsv(
          ["metric", "value"],
          [
            ["total", recommendations.total],
            ["took_recommendation", recommendations.accepted],
            ["kept_usual_time", recommendations.keptUsual],
            ["chose_own_time", recommendations.custom],
            ["no_decision_yet", recommendations.pending],
            ["adjusted_by_optimiser", recommendations.movedByOptimiser],
            [
              "acceptance_rate",
              recommendations.acceptanceRate === null
                ? "not_enough_decisions"
                : recommendations.acceptanceRate.toFixed(3),
            ],
          ]
        );
        break;
      }

      case "participation": {
        const { participation } = await loadCityOverview(city.code);
        csv = toCsv(
          ["metric", "value"],
          [
            ["registered_commuters", participation.totalUsers],
            ["completed_routine", participation.withRoutine],
            ["counted_in_city_figures", participation.sharingDemand],
            ["confirmed_plans_today", participation.confirmedToday],
            ["cancelled_today", participation.cancelledToday],
          ]
        );
        break;
      }

      case "mode-split": {
        const { modeSplit } = await loadCityOverview(city.code);
        csv = toCsv(
          ["mode", "label", "routines", "share"],
          modeSplit.map((mode) => [
            mode.mode,
            mode.label,
            mode.count,
            mode.share.toFixed(3),
          ])
        );
        break;
      }

      case "road-conditions": {
        /*
          Aggregated possible road issues. Counts, places and categories only —
          no reporter identity, exactly like every other report here.

          When there is nothing to report the file says WHY rather than being
          blank, because an operator opening an empty CSV cannot tell "no
          problems reported" from "the pipeline is broken".
        */
        const summary = await loadRoadConditionSummary(city.code);

        if (summary.totalIssues === 0) {
          csv = toCsv(
            ["status", "detail"],
            [
              [
                "no_data",
                "No road issues have been reported in this city yet. This is an empty dataset, not a survey result — the roads have not been inspected.",
              ],
              [
                "how_data_arrives",
                "Citizens report road problems at /roads, and phone motion sensors record possible road impacts during a trip.",
              ],
              [
                "note",
                "Inspection and repair are handled by the separate Municipal Dashboard, which is not part of this application.",
              ],
            ]
          );
          break;
        }

        csv = toCsv(
          [
            "reference",
            "area",
            "location_precision",
            "issue_type",
            "reported_severity",
            "confidence",
            "independent_reports",
            "sensor_detections",
            "priority_score",
            "priority_band",
            "first_reported",
            "last_reported",
            "handed_over_on",
          ],
          summary.priorityList.map((issue) => [
            `CF-RD-${issue.id.slice(-8).toUpperCase()}`,
            issue.areaLabel,
            issue.preciseLocation ? "approximate-gps" : "area-only",
            issueTypeLabel(issue.issueType),
            severityLabel(issue.severity),
            CONFIDENCE_META[issue.confidence].label,
            issue.reportCount,
            issue.sensorReportCount,
            issue.priorityScore,
            issue.priorityBand,
            issue.firstReportedAt.toISOString(),
            issue.lastReportedAt.toISOString(),
            issue.handedOverAt ? issue.handedOverAt.toISOString() : "not_yet",
          ])
        );
        break;
      }
    }

    const filename = `cityflow-${report}-${city.code}-${dateKey}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        // Reports are a snapshot of right now; never let one be cached.
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[admin export] failed:", error);
    return NextResponse.json(
      { error: "Could not build that report right now." },
      { status: 500 }
    );
  }
}
