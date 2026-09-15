import Link from "next/link";

import { ConfirmationBadge, PriorityBadge } from "@/components/badges";
import { Panel } from "@/components/panel";
import { Shell } from "@/components/shell";
import { confirmationOf, priorityOf } from "@/lib/classify";
import { queue } from "@/lib/defects";
import { staffContext } from "@/lib/context";
import { STATUS_LABELS } from "@/lib/transitions";

export const dynamic = "force-dynamic";

export default async function PriorityPage() {
  const { session, threshold, cityName } = await staffContext();
  const confirmed = await queue(session, threshold, {
    confirmedOnly: true,
    openOnly: true,
  });

  return (
    <Shell
      session={session}
      threshold={threshold}
      cityName={cityName}
      title="Priority & Confirmed Issues"
      subtitle={`Open reports at or above ${threshold} independent confirmations, in the
        order a crew should work through them.`}
    >
      {confirmed.length === 0 ? (
        <Panel>
          <p className="text-sm text-[var(--ink-muted)]">
            No open report has reached {threshold} confirmations. Lower the threshold in
            the sidebar to see what is close, or wait for more travellers to register the
            same places.
          </p>
        </Panel>
      ) : (
        <Panel
          title="Municipal Action Queue"
          subtitle="Ordered by how many independent travellers registered each place."
        >
          <ol>
            {confirmed.map((defect, index) => (
              <li
                key={defect.id}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-[var(--line)] py-3 last:border-0"
              >
                <span className="w-8 text-xl font-bold tabular-nums text-[var(--ink-faint)]">
                  {index + 1}
                </span>
                <span className="min-w-40">
                  <Link
                    href={`/reports/${defect.reference}`}
                    className="font-semibold text-[var(--navy)] hover:underline dark:text-[var(--accent)]"
                  >
                    {defect.reference}
                  </Link>
                  <span className="block text-xs text-[var(--ink-muted)]">
                    {defect.ward ? `Ward ${defect.ward}` : "Ward unknown"}
                  </span>
                </span>
                <span className="tabular-nums">
                  <strong>{defect.confirmations}</strong>{" "}
                  <span className="text-xs text-[var(--ink-muted)]">confirmations</span>
                </span>
                <span className="flex flex-wrap gap-1.5">
                  <PriorityBadge value={priorityOf(defect.confirmations, threshold)} />
                  <ConfirmationBadge
                    value={confirmationOf(defect.confirmations, threshold)}
                  />
                </span>
                <span className="text-xs text-[var(--ink-muted)]">
                  {STATUS_LABELS[defect.status]} &middot;{" "}
                  {defect.assignee ?? "nobody assigned"}
                </span>
              </li>
            ))}
          </ol>
        </Panel>
      )}
    </Shell>
  );
}
