import Link from "next/link";

import { ConfirmationBadge, PriorityBadge } from "@/components/badges";
import { Kpi, Panel } from "@/components/panel";
import { Shell } from "@/components/shell";
import { confirmationOf, priorityOf } from "@/lib/classify";
import { queue, queueMetrics } from "@/lib/defects";
import { staffContext } from "@/lib/context";

export const dynamic = "force-dynamic";

function resolveTime(seconds: number | null): string {
  if (seconds === null) return "—";
  const days = seconds / 86_400;
  return days >= 1 ? `${days.toFixed(1)} days` : `${(seconds / 3600).toFixed(1)} hours`;
}

export default async function DashboardPage() {
  const { session, threshold, cityName } = await staffContext();

  const [metrics, top] = await Promise.all([
    queueMetrics(session.city, threshold),
    queue(session, threshold, { openOnly: true, limit: 6 }),
  ]);

  return (
    <Shell
      session={session}
      threshold={threshold}
      cityName={cityName}
      title="Municipal Pothole Intelligence Dashboard"
      subtitle="Automatically detected road-impact reports, confirmation status, priority
        and field-work assignment for municipal road maintenance."
    >
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Detected Potholes"
          value={String(metrics.total)}
          note={`Reported across ${cityName}`}
        />
        <Kpi
          label="Confirmed"
          value={String(metrics.confirmed)}
          note={`${threshold} or more confirmations`}
        />
        <Kpi
          label="High / Critical"
          value={String(metrics.urgent)}
          note="Needs faster inspection"
        />
        <Kpi
          label="Awaiting Assignment"
          value={String(metrics.awaiting_assignment)}
          note="Confirmed and nobody sent"
        />
      </dl>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Panel
          title="Municipal Workflow"
          subtitle="How a jolt on somebody's phone becomes a work order."
        >
          <ol className="grid gap-3 sm:grid-cols-2">
            <Step
              number={1}
              title="Detect"
              body="A phone in a moving vehicle records a jolt that looks like a hole
                rather than a speed bump."
            />
            <Step
              number={2}
              title="Repeat"
              body="Detections from different travellers accumulate within about twenty
                metres of each other."
            />
            <Step
              number={3}
              title="Confirm"
              body={`At ${threshold} independent confirmations the report is treated as
                confirmed rather than under review.`}
            />
            <Step
              number={4}
              title="Assign"
              body="The head of road maintenance sends it to an employee or a field
                team, who closes it with a note."
            />
          </ol>
        </Panel>

        <Panel title="Priority Queue" subtitle="Open reports, most-confirmed first.">
          {top.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">
              Nothing open. Reports appear once several travellers register the same
              place.
            </p>
          ) : (
            <ul>
              {top.map((defect) => (
                <li
                  key={defect.id}
                  className="border-b border-[var(--line)] py-2.5 last:border-0"
                >
                  <Link
                    href={`/reports/${defect.reference}`}
                    className="text-sm font-bold text-[var(--navy)] hover:underline dark:text-[var(--accent)]"
                  >
                    {defect.reference}
                  </Link>
                  <p className="text-xs text-[var(--ink-muted)]">
                    {defect.ward ? `Ward ${defect.ward} · ` : ""}
                    <span className="tabular-nums">{defect.confirmations}</span>{" "}
                    confirmations
                  </p>
                  <p className="mt-1.5 flex flex-wrap gap-1.5">
                    <PriorityBadge value={priorityOf(defect.confirmations, threshold)} />
                    <ConfirmationBadge
                      value={confirmationOf(defect.confirmations, threshold)}
                    />
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel className="mt-4" title="Service Performance">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Measure label="Open reports" value={String(metrics.open_count)} />
          <Measure
            label="Median time to resolve"
            value={resolveTime(
              metrics.median_resolve_seconds === null
                ? null
                : Number(metrics.median_resolve_seconds),
            )}
          />
          <Measure
            label="Confirmation rate"
            value={
              metrics.total > 0
                ? `${Math.round((metrics.confirmed / metrics.total) * 100)}%`
                : "—"
            }
          />
        </dl>
      </Panel>
    </Shell>
  );
}

function Step({ number, title, body }: { number: number; title: string; body: string }) {
  return (
    <li className="rounded-[var(--radius)] border border-[var(--line)] p-3">
      <h3 className="text-sm font-bold">
        <span className="text-[var(--saffron)]">{number}.</span> {title}
      </h3>
      <p className="mt-1 text-xs text-[var(--ink-muted)]">{body}</p>
    </li>
  );
}

function Measure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--ink-muted)]">{label}</dt>
      <dd className="mt-0.5 text-xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}
