import Link from "next/link";

import { ConfirmationBadge, PriorityBadge } from "@/components/badges";
import { Panel } from "@/components/panel";
import { Shell } from "@/components/shell";
import { confirmationOf, PRIORITY_ORDER, priorityOf } from "@/lib/classify";
import { queue } from "@/lib/defects";
import { staffContext } from "@/lib/context";
import { STATUS_LABELS } from "@/lib/transitions";

export const dynamic = "force-dynamic";

const CONFIRMATIONS = ["Confirmed", "Under Review"] as const;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; confirmation?: string; priority?: string }>;
}) {
  const { session, threshold, cityName } = await staffContext();
  const params = await searchParams;

  const confirmation = CONFIRMATIONS.find((value) => value === params.confirmation);
  const priority = PRIORITY_ORDER.find((value) => value === params.priority);
  const search = params.q?.trim() || undefined;

  const defects = await queue(session, threshold, { search, confirmation, priority });

  return (
    <Shell
      session={session}
      threshold={threshold}
      cityName={cityName}
      title="Pothole Reports"
      subtitle="Every automatically detected road-impact location. Repeated confirmations
        from independent travellers decide which are worth a visit."
    >
      <form method="get" className="flex flex-wrap items-end gap-3">
        <Labelled label="Search report number or ward">
          <input
            name="q"
            defaultValue={search ?? ""}
            placeholder="PTH-2026 or 76"
            className="w-56 rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--surface-raised)] px-2 py-1.5 text-sm"
          />
        </Labelled>

        <Labelled label="Confirmation">
          <select
            name="confirmation"
            defaultValue={confirmation ?? ""}
            className="rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--surface-raised)] px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            {CONFIRMATIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </Labelled>

        <Labelled label="Priority">
          <select
            name="priority"
            defaultValue={priority ?? ""}
            className="rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--surface-raised)] px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            {PRIORITY_ORDER.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </Labelled>

        <button
          type="submit"
          className="rounded-[var(--radius)] bg-[var(--navy)] px-3 py-1.5 text-sm font-semibold text-white"
        >
          Apply
        </button>
      </form>

      <Panel
        className="mt-4"
        title={`${defects.length} report${defects.length === 1 ? "" : "s"}`}
        subtitle="Open a report to see its location and send somebody to it."
      >
        {defects.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">
            Nothing matches these filters. Clear the search or widen the priority.
          </p>
        ) : (
          <DefectTable defects={defects} threshold={threshold} />
        )}
      </Panel>
    </Shell>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function DefectTable({
  defects,
  threshold,
}: {
  defects: Awaited<ReturnType<typeof queue>>;
  threshold: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[54rem] border-collapse text-sm tabular-nums">
        <thead>
          <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-wide text-[var(--ink-muted)]">
            <th className="py-2 pr-4 font-semibold">Report</th>
            <th className="py-2 pr-4 font-semibold">Ward</th>
            <th className="py-2 pr-4 font-semibold">Confirmations</th>
            <th className="py-2 pr-4 font-semibold">Labels</th>
            <th className="py-2 pr-4 font-semibold">Stage</th>
            <th className="py-2 pr-4 font-semibold">Assigned to</th>
            <th className="py-2 font-semibold">Last detected</th>
          </tr>
        </thead>
        <tbody>
          {defects.map((defect) => (
            <tr key={defect.id} className="border-b border-[var(--line)] align-top">
              <td className="py-2.5 pr-4">
                <Link
                  href={`/reports/${defect.reference}`}
                  className="font-semibold text-[var(--navy)] hover:underline dark:text-[var(--accent)]"
                >
                  {defect.reference}
                </Link>
                <div className="font-mono text-[11px] text-[var(--ink-faint)]">
                  {defect.lat.toFixed(5)}, {defect.lon.toFixed(5)}
                </div>
              </td>
              <td className="py-2.5 pr-4">{defect.ward ?? "—"}</td>
              <td className="py-2.5 pr-4 font-semibold">{defect.confirmations}</td>
              <td className="py-2.5 pr-4">
                <span className="flex flex-wrap gap-1.5">
                  <PriorityBadge value={priorityOf(defect.confirmations, threshold)} />
                  <ConfirmationBadge
                    value={confirmationOf(defect.confirmations, threshold)}
                  />
                </span>
              </td>
              <td className="py-2.5 pr-4">{STATUS_LABELS[defect.status]}</td>
              <td className="py-2.5 pr-4 text-[var(--ink-muted)]">
                {defect.assignee ?? "Nobody yet"}
              </td>
              <td className="py-2.5 text-[var(--ink-muted)]">
                {new Date(defect.last_seen_at).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
