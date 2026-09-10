import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import type {
  Freshness,
  ModeShare,
  RecommendationStats,
  SystemHealth,
} from "@/lib/admin/analytics";
import { APP_TIMEZONE, APP_TIMEZONE_LABEL } from "@/lib/app-time";
import { cn } from "@/lib/utils";

/**
 * The Admin Portal's small panels: stat tiles, mode split, recommendation
 * outcomes, data freshness and system health.
 *
 * CHART DECISIONS MADE HERE
 *  - The mode split is a single-series magnitude comparison, so it is a plain
 *    horizontal bar chart in ONE colour with direct labels. Seven categorical
 *    hues would add nothing but a colour-vision problem.
 *  - Every figure is also written as a number next to its bar, so nothing
 *    depends on comparing bar lengths.
 *  - Status colours appear only where something has an actual status, and
 *    always beside a text label.
 */

/* -------------------------------------------------------------------------- */
/*  Stat tile                                                                  */
/* -------------------------------------------------------------------------- */

export function StatTile({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "alert";
}) {
  return (
    <div
      className={cn(
        "rounded-card border bg-surface p-5",
        tone === "alert" ? "border-traffic-high" : "border-border-base"
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-subtle">{label}</p>
      <p
        className={cn(
          "mt-2 text-3xl font-semibold tracking-tight",
          tone === "alert" ? "text-traffic-high" : "text-fg"
        )}
      >
        {value}
      </p>
      {detail && <p className="mt-1.5 text-xs leading-relaxed text-muted">{detail}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Travel-mode split                                                          */
/* -------------------------------------------------------------------------- */

export function ModeSplitPanel({ modes }: { modes: ModeShare[] }) {
  const total = modes.reduce((sum, mode) => sum + mode.count, 0);

  return (
    <Card>
      <CardHeader
        title="Travel-mode split"
        description="Primary mode from registered travel routines."
      />

      {total === 0 ? (
        <EmptyNote>
          No routines are being counted for this city yet. Figures appear once people
          complete onboarding and leave city-level counting switched on.
        </EmptyNote>
      ) : (
        <>
          <ul className="space-y-2.5">
            {modes.map((mode) => (
              <li key={mode.mode}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-fg">{mode.label}</span>
                  <span className="text-muted">
                    <span className="font-semibold text-fg">{mode.count}</span>{" "}
                    <span className="text-xs">({Math.round(mode.share * 100)}%)</span>
                  </span>
                </div>

                {/* Single series, single colour — the number beside it carries
                    the value, the bar only makes comparison quick. */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(mode.share * 100, mode.count > 0 ? 2 : 0)}%` }}
                    aria-hidden="true"
                  />
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs leading-relaxed text-subtle">
            Based on {total} routine{total === 1 ? "" : "s"}. Metro, walking and cycling do
            not use road capacity, which is why they are reported separately from the
            vehicle modes.
          </p>
        </>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Recommendation outcomes                                                    */
/* -------------------------------------------------------------------------- */

export function RecommendationPanel({ stats }: { stats: RecommendationStats }) {
  const rows = [
    { label: "Took the recommendation", value: stats.accepted },
    { label: "Kept their usual time", value: stats.keptUsual },
    { label: "Chose their own time", value: stats.custom },
    { label: "No decision yet", value: stats.pending },
  ];

  const max = Math.max(1, ...rows.map((row) => row.value));

  return (
    <Card>
      <CardHeader
        title="Recommendation outcomes"
        description="What people did with today's suggestions."
      />

      {stats.total === 0 ? (
        <EmptyNote>No recommendations have been generated for today yet.</EmptyNote>
      ) : (
        <>
          <ul className="space-y-2.5">
            {rows.map((row) => (
              <li key={row.label}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-fg">{row.label}</span>
                  <span className="font-semibold text-fg">{row.value}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-secondary"
                    style={{ width: `${(row.value / max) * 100}%` }}
                    aria-hidden="true"
                  />
                </div>
              </li>
            ))}
          </ul>

          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border-base pt-4 text-sm">
            <div>
              <dt className="text-muted">Acceptance rate</dt>
              <dd className="mt-0.5 font-semibold text-fg">
                {stats.acceptanceRate === null
                  ? "Not enough decisions yet"
                  : `${Math.round(stats.acceptanceRate * 100)}%`}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Adjusted by the optimiser</dt>
              <dd className="mt-0.5 font-semibold text-fg">{stats.movedByOptimiser}</dd>
            </div>
          </dl>
        </>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Data freshness                                                             */
/* -------------------------------------------------------------------------- */

export function FreshnessPanel({ freshness }: { freshness: Freshness }) {
  const rows: Array<{ label: string; at: Date | null; whenNull: string }> = [
    {
      label: "Demand aggregation",
      at: freshness.aggregateUpdatedAt,
      whenNull: "No confirmed trips recorded today",
    },
    {
      label: "Last re-optimisation",
      at: freshness.lastOptimisationAt,
      whenNull: "No recommendation needed adjusting today",
    },
    {
      label: "Last confirmed plan",
      at: freshness.lastConfirmationAt,
      whenNull: "Nobody has confirmed a plan today",
    },
  ];

  return (
    <Card>
      <CardHeader
        title="Data freshness"
        description={`All times in ${APP_TIMEZONE_LABEL}.`}
      />

      <dl className="space-y-3 text-sm">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-4 border-b border-border-base pb-3 last:border-0 last:pb-0"
          >
            <dt className="text-muted">{row.label}</dt>
            <dd className="text-right">
              {row.at ? (
                <>
                  <span className="font-medium text-fg">{formatClock(row.at)}</span>
                  <span className="block text-xs text-subtle">{relativeTo(row.at)}</span>
                </>
              ) : (
                <span className="text-xs text-subtle">{row.whenNull}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 text-xs leading-relaxed text-subtle">
        Demand prediction runs on every request rather than on a schedule, so there is no
        &ldquo;last forecast&rdquo; time to report — the figures on this page were computed
        when you loaded it.
      </p>
    </Card>
  );
}

function formatClock(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: APP_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function relativeTo(date: Date): string {
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
}

/* -------------------------------------------------------------------------- */
/*  System health                                                              */
/* -------------------------------------------------------------------------- */

export function SystemHealthPanel({ health }: { health: SystemHealth }) {
  const STATUS_LABEL = {
    ok: "Running",
    idle: "Idle",
    "not-connected": "Not connected",
  } as const;

  return (
    <Card>
      <CardHeader
        title="System status"
        description="What is running, what is idle, and what is honestly not built yet."
      />

      <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-surface-2 p-3">
        <div>
          <p className="text-sm font-medium text-fg">Database</p>
          <p className="text-xs text-muted">
            {health.database.ok
              ? `Responded in ${health.database.responseMs} ms`
              : "Could not be reached"}
          </p>
        </div>
        <Badge tone={health.database.ok ? "low" : "high"}>
          {health.database.ok ? "Connected" : "Unreachable"}
        </Badge>
      </div>

      <ul className="space-y-2.5">
        {health.services.map((service) => (
          <li
            key={service.name}
            className="flex items-start justify-between gap-4 border-b border-border-base pb-2.5 last:border-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg">{service.name}</p>
              <p className="text-xs leading-relaxed text-muted">{service.detail}</p>
            </div>

            <Badge
              tone={
                service.status === "ok"
                  ? "low"
                  : service.status === "idle"
                    ? "neutral"
                    : "moderate"
              }
            >
              {STATUS_LABEL[service.status]}
            </Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border-strong bg-surface-2 p-5 text-center">
      <p className="text-sm leading-relaxed text-muted">{children}</p>
    </div>
  );
}
