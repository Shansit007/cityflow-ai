import type { DefectRow } from "@/lib/defects";

function age(from: Date): string {
  const days = Math.floor((Date.now() - from.getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "1 day";
  if (days < 60) return `${days} days`;
  return `${Math.floor(days / 30)} months`;
}

const STATUS_LABELS: Record<string, string> = {
  reported: "Reported",
  triaged: "Triaged",
  assigned: "Assigned",
  in_progress: "In progress",
  resolved: "Resolved",
  rejected: "Rejected",
};

export function QueueTable({
  defects,
  threshold,
}: {
  defects: DefectRow[];
  threshold: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[46rem] border-collapse text-sm tabular-nums">
        <thead>
          <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-wide text-[var(--ink-muted)]">
            <th scope="col" className="py-2 pr-4 font-medium">
              Severity
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Status
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Confirmed by
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              First seen
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Location
            </th>
            <th scope="col" className="py-2 font-medium">
              Assigned to
            </th>
          </tr>
        </thead>
        <tbody>
          {defects.map((defect) => {
            const severity = Number(defect.severity);
            const priority = severity >= threshold;

            return (
              <tr key={defect.id} className="border-b border-[var(--line)]">
                <td className="py-2.5 pr-4">
                  <span className={priority ? "font-semibold" : undefined}>
                    {severity.toFixed(2)}
                  </span>
                  {priority ? (
                    <span className="ml-2 rounded border border-[var(--line-strong)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                      Priority
                    </span>
                  ) : null}
                </td>
                <td className="py-2.5 pr-4">
                  {STATUS_LABELS[defect.status] ?? defect.status}
                </td>
                <td className="py-2.5 pr-4">{defect.confirmations} travellers</td>
                <td className="py-2.5 pr-4 text-[var(--ink-muted)]">
                  {age(new Date(defect.first_seen_at))}
                </td>
                <td className="py-2.5 pr-4 font-mono text-xs">
                  {defect.lat.toFixed(5)}, {defect.lon.toFixed(5)}
                </td>
                <td className="py-2.5 text-[var(--ink-muted)]">
                  {defect.assignee ?? "Nobody yet"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
