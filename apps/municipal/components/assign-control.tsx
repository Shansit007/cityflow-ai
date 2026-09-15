"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Employee, Team } from "@/lib/defects";

export function AssignControl({
  defectId,
  assignedTo,
  assignedTeam,
  employees,
  teams,
  label = "Assign to",
}: {
  defectId: string;
  assignedTo: string | null;
  assignedTeam: string | null;
  employees: Employee[];
  teams: Team[];
  label?: string;
}) {
  const router = useRouter();
  const current = assignedTo
    ? `user:${assignedTo}`
    : assignedTeam
      ? `team:${assignedTeam}`
      : "";

  const [value, setValue] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function apply(next: string) {
    setValue(next);
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/defects/${defectId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignee: next || null }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? "That assignment was refused.");
        setValue(current);
        return;
      }

      router.refresh();
    } catch {
      setError("Could not reach the server.");
      setValue(current);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <label
        htmlFor={`assign-${defectId}`}
        className="block text-xs font-semibold text-[var(--ink-muted)]"
      >
        {label}
      </label>
      <select
        id={`assign-${defectId}`}
        value={value}
        disabled={busy}
        onChange={(event) => apply(event.target.value)}
        className="w-full rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--surface-raised)] px-2 py-1.5 text-sm"
      >
        <option value="">Unassigned</option>
        <optgroup label="Employees">
          {employees.map((person) => (
            <option key={person.id} value={`user:${person.id}`}>
              {person.display_name}
              {person.job_title ? ` — ${person.job_title}` : ""}
            </option>
          ))}
        </optgroup>
        <optgroup label="Field teams">
          {teams.map((team) => (
            <option key={team.id} value={`team:${team.id}`}>
              {team.name}
            </option>
          ))}
        </optgroup>
      </select>
      {error ? (
        <p role="alert" className="text-xs text-[var(--warn)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
