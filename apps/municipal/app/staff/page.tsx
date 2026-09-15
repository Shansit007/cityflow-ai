import { Panel } from "@/components/panel";
import { Shell } from "@/components/shell";
import { employees, teams } from "@/lib/defects";
import { staffContext } from "@/lib/context";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const { session, threshold, cityName } = await staffContext();
  const [crew, crews] = await Promise.all([employees(session.city), teams(session.city)]);

  return (
    <Shell
      session={session}
      threshold={threshold}
      cityName={cityName}
      title="Employees & Teams"
      subtitle="Field staff available for pothole inspection and road-maintenance work.
        Unlike traveller accounts, these are named: everything done here is on behalf of
        the council and has to be attributable."
    >
      <Panel title="Employees" subtitle={`${crew.length} active in ${cityName}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                <th className="py-2 pr-4 font-semibold">Employee</th>
                <th className="py-2 pr-4 font-semibold">Role</th>
                <th className="py-2 font-semibold">Team</th>
              </tr>
            </thead>
            <tbody>
              {crew.map((person) => (
                <tr key={person.id} className="border-b border-[var(--line)]">
                  <td className="py-2.5 pr-4 font-medium">{person.display_name}</td>
                  <td className="py-2.5 pr-4 text-[var(--ink-muted)]">
                    {person.job_title ?? "—"}
                  </td>
                  <td className="py-2.5 text-[var(--ink-muted)]">
                    {person.team_name ?? "Unassigned"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="mt-4" title="Field Teams">
        <ul className="grid gap-3 sm:grid-cols-2">
          {crews.map((team) => {
            const members = crew.filter((person) => person.team_name === team.name);
            return (
              <li
                key={team.id}
                className="rounded-[var(--radius)] border border-[var(--line)] p-3"
              >
                <h3 className="text-sm font-bold">{team.name}</h3>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">
                  {members.length > 0
                    ? members.map((person) => person.display_name).join(", ")
                    : "No employees on this roster yet."}
                </p>
              </li>
            );
          })}
        </ul>
      </Panel>
    </Shell>
  );
}
