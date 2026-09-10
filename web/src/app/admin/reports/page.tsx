import type { Metadata } from "next";

import { CitySwitcher } from "@/components/admin/city-switcher";
import { StatTile } from "@/components/admin/panels";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { loadCityOverview, loadZoneDemand } from "@/lib/admin/analytics";
import { formatAppDate } from "@/lib/app-time";
import { getCity } from "@/lib/cities";

export const metadata: Metadata = { title: "Reports" };

/**
 * Admin Portal — reports.
 *
 * Each report is a CSV download built from the same aggregation functions the
 * portal displays, so a downloaded file can never disagree with the screen.
 *
 * The road-condition report is listed even though it has no data yet, and says
 * so. Hiding it would leave an operator wondering whether it exists; a silently
 * empty file would leave them wondering whether it is broken.
 */

const REPORTS = [
  {
    id: "daily-demand",
    title: "Daily demand",
    description:
      "Every 15-minute slot today: baseline prediction, confirmed trips, adjusted index, and whether it is over capacity.",
    available: true,
  },
  {
    id: "zone-demand",
    title: "Zone demand",
    description:
      "Expected trips per origin area per slot. Counts only — no route, no identity.",
    available: true,
  },
  {
    id: "recommendations",
    title: "Recommendation usage",
    description:
      "How many people took the suggestion, kept their usual time, chose their own, or have not decided — plus how many the optimiser adjusted.",
    available: true,
  },
  {
    id: "participation",
    title: "User participation",
    description:
      "Registered commuters, completed routines, how many are counted in city figures, and today's confirmations.",
    available: true,
  },
  {
    id: "mode-split",
    title: "Travel-mode distribution",
    description: "Primary transport mode across registered routines.",
    available: true,
  },
  {
    id: "road-conditions",
    title: "Road-condition data availability",
    description:
      "Smartphone road-impact detection is built in Phase 5. This report currently explains that no data exists yet.",
    available: false,
  },
] as const;

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const params = await searchParams;
  const city = getCity(params.city);

  const [overview, zones] = await Promise.all([
    loadCityOverview(city.code),
    loadZoneDemand(city.code),
  ]);

  return (
    <section className="py-8">
      <Container width="wide">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              Reports
            </h1>
            <p className="mt-2 text-sm text-muted">
              {overview.cityName} · {formatAppDate()}
            </p>
          </div>

          <CitySwitcher active={city.code} basePath="/admin/reports" />
        </div>

        {/* A summary of what today's reports would contain, so an operator can
            see whether a download is worth taking. */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Demand slots"
            value={String(overview.dayCurve.length)}
            detail="Rows in the daily demand report"
          />
          <StatTile
            label="Zones"
            value={String(zones.rows.length)}
            detail="Rows in the zone demand report"
          />
          <StatTile
            label="Recommendations"
            value={String(overview.recommendations.total)}
            detail="Generated for today"
          />
          <StatTile
            label="Routines"
            value={String(overview.participation.withRoutine)}
            detail={`${overview.participation.sharingDemand} counted in city figures`}
          />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {REPORTS.map((report) => (
            <Card key={report.id}>
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold text-fg">{report.title}</h2>
                {report.available ? (
                  <Badge tone="low">Available</Badge>
                ) : (
                  <Badge tone="moderate">No data yet</Badge>
                )}
              </div>

              <p className="mt-2 text-sm leading-relaxed text-muted">{report.description}</p>

              <a
                href={`/api/admin/export?report=${report.id}&city=${city.code}`}
                download
                className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 3v12M7 11l5 5 5-5M4 21h16" />
                </svg>
                Download CSV
              </a>
            </Card>
          ))}
        </div>

        <Card className="mt-6">
          <CardHeader title="What these reports may and may not contain" />
          <ul className="space-y-2 text-sm leading-relaxed text-muted">
            <li>
              <span className="font-medium text-fg">Counts and averages only.</span> No user
              id, CityFlow ID, email, home area or route appears in any export. The queries
              behind them do not select those columns.
            </li>
            <li>
              <span className="font-medium text-fg">Consent is respected.</span> A person who
              switched off &ldquo;count my trip in city-level demand totals&rdquo; is excluded
              from every figure, in the portal and in the downloads alike.
            </li>
            <li>
              <span className="font-medium text-fg">Predictions are labelled.</span> Demand
              figures are model output, not measured traffic counts. Any report shared outside
              the team should carry that caveat with it.
            </li>
            <li>
              <span className="font-medium text-fg">Reports are a snapshot.</span> They are
              built when you press the button and are never cached, so two downloads a minute
              apart can legitimately differ.
            </li>
          </ul>
        </Card>
      </Container>
    </section>
  );
}
