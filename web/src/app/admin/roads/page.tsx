import type { Metadata } from "next";

import { CitySwitcher } from "@/components/admin/city-switcher";
import { EmptyNote, StatTile } from "@/components/admin/panels";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { formatAppDate } from "@/lib/app-time";
import { getCity } from "@/lib/cities";
import { loadRoadConditionSummary } from "@/lib/roads/road-service";
import {
  CONFIDENCE_META,
  issueTypeLabel,
  severityLabel,
  type RoadIssueConfidence,
} from "@/lib/roads/types";

export const metadata: Metadata = { title: "Road conditions" };

/**
 * Admin Portal — aggregated road-condition monitoring.
 *
 * ======================= WHAT THIS SCREEN DELIBERATELY LACKS ================
 * There is no "assign", no "mark inspected", no "mark repaired", no due date
 * and no crew. Building any of those here would be quietly recreating the
 * Municipal Dashboard — a separate, already-existing system that owns the
 * inspect → repair → update workflow and is the only place with the ground
 * truth to fill those fields in honestly.
 *
 * What this screen does instead is the part CityFlow AI is actually able to do:
 * show how much possible road damage has been reported, how strong the evidence
 * is, where it clusters, and which items should be looked at first given how
 * many people travel through each area. Then it hands that list over.
 * ============================================================================
 */
export default async function AdminRoadsPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const params = await searchParams;
  const city = getCity(params.city);
  const summary = await loadRoadConditionSummary(city.code);

  return (
    <section className="py-8">
      <Container width="wide">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              Road conditions
            </h1>
            <p className="mt-2 text-sm text-muted">
              {city.name} · {formatAppDate()}
            </p>
          </div>

          <CitySwitcher active={city.code} basePath="/admin/roads" />
        </div>

        {summary.totalIssues === 0 ? (
          <Card className="mt-8">
            <CardHeader title="No road issues reported yet" />
            <EmptyNote>
              Nobody in {city.name} has reported a road problem, and no phone has recorded a
              road impact. This is an empty dataset, not a clean bill of health — the roads
              have not been surveyed, they simply have not been reported on.
            </EmptyNote>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Reports arrive from the commuter portal at <code className="text-fg">/roads</code>
              , either from a person filling in the form or from a phone&apos;s motion sensors
              during a trip.
            </p>
          </Card>
        ) : (
          <>
            {/* ------------------------------------------------ headline counts */}
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label="Places reported"
                value={String(summary.totalIssues)}
                detail={`${summary.citizenReports} citizen report${summary.citizenReports === 1 ? "" : "s"}, ${summary.sensorDetections} sensor detection${summary.sensorDetections === 1 ? "" : "s"}`}
              />
              <StatTile
                label="Reported as dangerous"
                value={String(summary.bySeverity.HIGH)}
                detail="Worst severity anybody reported for that place"
              />
              <StatTile
                label="Awaiting hand-over"
                value={String(summary.awaitingHandover)}
                detail={`${summary.handedOver} already sent to the municipal team`}
              />
              <StatTile
                label="Most recent report"
                value={
                  summary.lastReportAt
                    ? summary.lastReportAt.toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })
                    : "—"
                }
                detail={
                  summary.lastReportAt
                    ? summary.lastReportAt.toLocaleTimeString("en-IN", {
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "No reports yet"
                }
              />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              {/* --------------------------------------------- evidence split */}
              <Card>
                <CardHeader
                  title="Strength of evidence"
                  description="How many independent reports agree about each place."
                />
                <ul className="space-y-3">
                  {(
                    ["CONFIRMED_BY_REPORTS", "LIKELY", "POSSIBLE"] as RoadIssueConfidence[]
                  ).map((level) => (
                    <li key={level} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-fg">
                          {CONFIDENCE_META[level].label}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted">
                          {CONFIDENCE_META[level].sentence}
                        </p>
                      </div>
                      <span className="shrink-0 text-lg font-semibold tabular-nums text-fg">
                        {summary.byConfidence[level]}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>

              {/* ------------------------------------------------- issue types */}
              <Card>
                <CardHeader title="What is being reported" />
                {summary.byType.length === 0 ? (
                  <EmptyNote>Nothing reported yet.</EmptyNote>
                ) : (
                  <ul className="space-y-2">
                    {summary.byType.map((row) => (
                      <li
                        key={row.type}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="min-w-0 truncate text-muted">
                          {issueTypeLabel(row.type)}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-fg">
                          {row.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {/* ------------------------------------------------------ zones */}
              <Card>
                <CardHeader
                  title="Areas with the most reports"
                  description="With how many trips a day pass through each, since that is what makes a road matter."
                />
                {summary.topZones.length === 0 ? (
                  <EmptyNote>Nothing reported yet.</EmptyNote>
                ) : (
                  <ul className="space-y-2">
                    {summary.topZones.map((zone) => (
                      <li
                        key={zone.zoneKey}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="min-w-0 truncate text-muted">{zone.zoneLabel}</span>
                        <span className="shrink-0 text-xs text-subtle">
                          <span className="font-semibold tabular-nums text-fg">
                            {zone.count}
                          </span>{" "}
                          issue{zone.count === 1 ? "" : "s"} ·{" "}
                          <span className="tabular-nums">{zone.trips}</span> trips
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            {/* ------------------------------------------------ priority list */}
            <Card className="mt-6">
              <CardHeader
                title="Suggested priority order"
                description="Advisory only. Ranked by evidence, reported severity and how many trips pass through the area."
                action={
                  <a
                    href={`/api/admin/roads/handoff?city=${city.code}`}
                    download
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
                  >
                    Download hand-off file
                  </a>
                }
              />

              <div className="overflow-x-auto">
                <table className="w-full min-w-[46rem] border-collapse text-sm">
                  <caption className="sr-only-cf">
                    Possible road issues in {city.name}, ordered by suggested priority
                  </caption>
                  <thead>
                    <tr className="border-b border-border-base text-left text-xs uppercase tracking-wide text-subtle">
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Priority
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Issue
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Area
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Severity
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Evidence
                      </th>
                      <th scope="col" className="py-2 font-medium">
                        Handed over
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.priorityList.map((issue) => (
                      <tr key={issue.id} className="border-b border-border-base last:border-0">
                        <td className="py-2.5 pr-3">
                          <span className="inline-flex items-center gap-2">
                            <span className="font-semibold tabular-nums text-fg">
                              {issue.priorityScore}
                            </span>
                            {/* The band is spelled out, never colour alone. */}
                            <span className="text-xs capitalize text-muted">
                              {issue.priorityBand}
                            </span>
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-fg">
                          {issueTypeLabel(issue.issueType)}
                        </td>
                        <td className="py-2.5 pr-3 text-muted">
                          {issue.areaLabel}
                          {!issue.preciseLocation && (
                            <span className="ml-1.5 text-xs text-subtle">(area only)</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-muted">
                          {severityLabel(issue.severity)}
                        </td>
                        <td className="py-2.5 pr-3">
                          <Badge tone={CONFIDENCE_META[issue.confidence].tone}>
                            {issue.reportCount} report{issue.reportCount === 1 ? "" : "s"}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-xs text-muted">
                          {issue.handedOverAt
                            ? issue.handedOverAt.toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                              })
                            : "Not yet"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {/* ------------------------------------------------- the boundary note */}
        <Card className="mt-6">
          <CardHeader title="Where CityFlow AI's responsibility ends" />
          <ul className="space-y-2 text-sm leading-relaxed text-muted">
            <li>
              <span className="font-medium text-fg">Nothing here has been inspected.</span>{" "}
              &ldquo;Confirmed by multiple reports&rdquo; means reporters agree, not that a
              defect has been verified on the ground.
            </li>
            <li>
              <span className="font-medium text-fg">
                Inspection and repair belong to the Municipal Dashboard.
              </span>{" "}
              That is a separate, already-existing system. This portal does not schedule,
              assign or track repairs, and has no way of learning whether one happened.
            </li>
            <li>
              <span className="font-medium text-fg">The priority order is advisory.</span> It
              cannot see school routes, hospital approaches, works already under way or local
              commitments. The municipal authority&apos;s own ordering should override it.
            </li>
            <li>
              <span className="font-medium text-fg">No reporter is identifiable here.</span>{" "}
              This screen and the hand-off file carry places, categories, counts and a score —
              never who reported what.
            </li>
          </ul>
        </Card>
      </Container>
    </section>
  );
}
