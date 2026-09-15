import Link from "next/link";

import { AssignControl } from "@/components/assign-control";
import { PriorityBadge } from "@/components/badges";
import { Panel } from "@/components/panel";
import { Shell } from "@/components/shell";
import { priorityOf } from "@/lib/classify";
import { employees, queue, teams } from "@/lib/defects";
import { staffContext } from "@/lib/context";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage() {
  const { session, threshold, cityName } = await staffContext();

  const [confirmed, crew, crews] = await Promise.all([
    queue(session, threshold, { confirmedOnly: true, openOnly: true }),
    session.role === "head" ? employees(session.city) : Promise.resolve([]),
    session.role === "head" ? teams(session.city) : Promise.resolve([]),
  ]);

  if (session.role !== "head") {
    return (
      <Shell
        session={session}
        threshold={threshold}
        cityName={cityName}
        title="Work Assignments"
        subtitle="Assignment is handled by the head of road maintenance."
      >
        <Panel>
          <p className="text-sm text-[var(--ink-muted)]">
            Your own work is on the{" "}
            <Link href="/reports" className="font-semibold text-[var(--navy)] underline">
              Pothole Reports
            </Link>{" "}
            page, which shows the reports assigned to you and to your team.
          </p>
        </Panel>
      </Shell>
    );
  }

  return (
    <Shell
      session={session}
      threshold={threshold}
      cityName={cityName}
      title="Work Assignments"
      subtitle="Send a confirmed report to an employee or a field team for on-site
        inspection. Assigning moves it out of triage automatically."
    >
      {confirmed.length === 0 ? (
        <Panel>
          <p className="text-sm text-[var(--ink-muted)]">
            Confirmed reports appear here once they cross {threshold} confirmations.
          </p>
        </Panel>
      ) : (
        <div className="grid gap-3">
          {confirmed.map((defect) => (
            <Panel key={defect.id}>
              <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
                <div>
                  <h2 className="text-base font-bold">
                    <Link
                      href={`/reports/${defect.reference}`}
                      className="text-[var(--navy)] hover:underline dark:text-[var(--accent)]"
                    >
                      {defect.reference}
                    </Link>
                  </h2>
                  <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                    {defect.ward ? `Ward ${defect.ward} · ` : ""}
                    <span className="font-mono">
                      {defect.lat.toFixed(5)}, {defect.lon.toFixed(5)}
                    </span>
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <strong className="tabular-nums">{defect.confirmations}</strong>
                    <span className="text-[var(--ink-muted)]">confirmations</span>
                    <PriorityBadge value={priorityOf(defect.confirmations, threshold)} />
                  </p>
                  <p className="mt-1 text-xs text-[var(--ink-muted)]">
                    Last detected{" "}
                    {new Date(defect.last_seen_at).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>

                <AssignControl
                  defectId={defect.id}
                  assignedTo={defect.assigned_to}
                  assignedTeam={defect.assigned_team}
                  employees={crew}
                  teams={crews}
                  label="Employee or field team"
                />
              </div>
            </Panel>
          ))}
        </div>
      )}
    </Shell>
  );
}
