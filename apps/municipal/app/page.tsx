import { redirect } from "next/navigation";
import { AppShell } from "@cityflow/ui";

import { QueueTable } from "@/components/queue-table";
import { SignOut } from "@/components/sign-out";
import { ThresholdControl } from "@/components/threshold-control";
import { employees, priorityThreshold, queue, queueMetrics } from "@/lib/defects";
import { DEFECT_STATUSES, type DefectStatus } from "@/lib/transitions";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function hours(seconds: number | null): string {
  if (seconds === null) return "—";
  const days = seconds / 86_400;
  return days >= 1 ? `${days.toFixed(1)} days` : `${(seconds / 3600).toFixed(1)} hours`;
}

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; severity?: string }>;
}) {
  const session = await readSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const status = DEFECT_STATUSES.includes(params.status as DefectStatus)
    ? (params.status as DefectStatus)
    : undefined;
  const minSeverity = Number.isFinite(Number(params.severity))
    ? Math.min(Math.max(Number(params.severity), 0), 1)
    : 0;

  const [threshold, metrics, defects, crew] = await Promise.all([
    priorityThreshold(session.city),
    queueMetrics(session.city),
    queue(session, { status, minSeverity }),
    session.role === "head" ? employees(session.city) : Promise.resolve([]),
  ]);

  return (
    <AppShell
      productName="CityFlow AI"
      surface="Municipal"
      nav={
        <span className="flex items-center gap-4">
          <span className="text-[var(--ink-muted)]">
            {session.displayName} · {session.city} ·{" "}
            {session.role === "head" ? "Head" : "Crew"}
          </span>
          <SignOut />
        </span>
      }
      footnote="Defect reports are aggregated from multiple independent travellers. A single anomaly is never a defect."
    >
      <h1 className="text-xl font-semibold tracking-tight">Road defect queue</h1>

      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--line)] sm:grid-cols-4">
        <Metric label="Open" value={String(metrics.open_count)} />
        <Metric label="Awaiting assignment" value={String(metrics.unassigned)} />
        <Metric label="Reported this month" value={String(metrics.this_month)} />
        <Metric
          label="Median time to resolve"
          value={hours(
            metrics.median_resolve_seconds === null
              ? null
              : Number(metrics.median_resolve_seconds),
          )}
        />
      </dl>

      <form method="get" className="mt-8 flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">
            Status
          </span>
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--surface-raised)] px-2 py-1.5"
          >
            <option value="">Any</option>
            {DEFECT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">
            Minimum severity
          </span>
          <input
            name="severity"
            type="number"
            min="0"
            max="1"
            step="0.05"
            defaultValue={minSeverity || ""}
            placeholder="0.00"
            className="w-28 rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--surface-raised)] px-2 py-1.5 tabular-nums"
          />
        </label>

        <button
          type="submit"
          className="rounded-[var(--radius)] border border-[var(--line-strong)] px-3 py-1.5 font-medium"
        >
          Apply
        </button>
      </form>

      <div className="mt-6">
        {session.role === "head" ? (
          <ThresholdControl threshold={threshold} />
        ) : (
          <p className="text-xs text-[var(--ink-muted)]">
            Priority is severity at or above {threshold.toFixed(2)}, set for{" "}
            {session.city} by the head of road maintenance.
          </p>
        )}
      </div>

      <div className="mt-3">
        {defects.length > 0 ? (
          <QueueTable
            defects={defects}
            employees={crew}
            role={session.role}
            threshold={threshold}
          />
        ) : (
          <EmptyQueue role={session.role} filtered={Boolean(status) || minSeverity > 0} />
        )}
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--surface-raised)] p-4">
      <dt className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function EmptyQueue({ role, filtered }: { role: string; filtered: boolean }) {
  if (filtered) {
    return (
      <p className="rounded-[var(--radius)] border border-dashed border-[var(--line-strong)] p-6 text-sm text-[var(--ink-muted)]">
        No defects match these filters. Widen the severity or clear the status.
      </p>
    );
  }

  return (
    <p className="rounded-[var(--radius)] border border-dashed border-[var(--line-strong)] p-6 text-sm text-[var(--ink-muted)]">
      {role === "employee"
        ? "Nothing is assigned to you. The head of road maintenance assigns work from this queue."
        : "No defects reported yet. A defect appears here once several travellers independently register the same anomaly at the same place."}
    </p>
  );
}
