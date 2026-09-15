"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { DefectRow, Employee } from "@/lib/defects";
import type { Role } from "@/lib/session";
import { allowedTransitions, STATUS_LABELS, type DefectStatus } from "@/lib/transitions";

const ACTION_LABELS: Record<DefectStatus, string> = {
  reported: "Reopen",
  triaged: "Triage",
  assigned: "Assign",
  in_progress: "Start work",
  resolved: "Resolve",
  rejected: "Reject",
};

function age(from: Date): string {
  const days = Math.floor((Date.now() - from.getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "1 day";
  if (days < 60) return `${days} days`;
  return `${Math.floor(days / 30)} months`;
}

export function QueueTable({
  defects,
  employees,
  role,
  threshold,
}: {
  defects: DefectRow[];
  employees: Employee[];
  role: Role;
  threshold: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id);
    setError(null);

    try {
      const response = await fetch(`/api/defects/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? "That change was refused.");
        return;
      }

      setResolving(null);
      setNote("");
      router.refresh();
    } catch {
      setError("Could not reach the server. The queue may be out of date.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {error ? (
        <p
          role="alert"
          className="mb-3 rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--warn)]"
        >
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[60rem] border-collapse text-sm tabular-nums">
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-wide text-[var(--ink-muted)]">
              <th className="py-2 pr-4 font-medium">Severity</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">Confirmed by</th>
              <th className="py-2 pr-4 font-medium">First seen</th>
              <th className="py-2 pr-4 font-medium">Location</th>
              <th className="py-2 pr-4 font-medium">Assigned to</th>
              <th className="py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {defects.map((defect) => {
              const severity = Number(defect.severity);
              const priority = severity >= threshold;
              const next = allowedTransitions(role, defect.status);
              const working = busy === defect.id;

              return (
                <tr key={defect.id} className="border-b border-[var(--line)] align-top">
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
                  <td className="py-2.5 pr-4">{STATUS_LABELS[defect.status]}</td>
                  <td className="py-2.5 pr-4">{defect.confirmations} travellers</td>
                  <td className="py-2.5 pr-4 text-[var(--ink-muted)]">
                    {age(new Date(defect.first_seen_at))}
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-xs">
                    {defect.lat.toFixed(5)}, {defect.lon.toFixed(5)}
                  </td>
                  <td className="py-2.5 pr-4">
                    {role === "head" &&
                    defect.status !== "resolved" &&
                    defect.status !== "rejected" ? (
                      <select
                        aria-label="Assign this defect"
                        value={defect.assigned_to ?? ""}
                        disabled={working}
                        onChange={(event) =>
                          patch(defect.id, { assignedTo: event.target.value || null })
                        }
                        className="rounded border border-[var(--line-strong)] bg-[var(--surface-raised)] px-1.5 py-1 text-xs"
                      >
                        <option value="">Nobody</option>
                        {employees.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.display_name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-[var(--ink-muted)]">
                        {defect.assignee ?? "Nobody yet"}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5">
                    {resolving === defect.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          autoFocus
                          value={note}
                          maxLength={500}
                          placeholder="What was done?"
                          onChange={(event) => setNote(event.target.value)}
                          className="w-56 rounded border border-[var(--line-strong)] bg-[var(--surface-raised)] px-2 py-1 text-xs"
                        />
                        <Action
                          disabled={working || !note.trim()}
                          onClick={() => patch(defect.id, { status: "resolved", note })}
                        >
                          Save
                        </Action>
                        <Action onClick={() => setResolving(null)}>Cancel</Action>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {next.map((to) => (
                          <Action
                            key={to}
                            disabled={working}
                            onClick={() =>
                              to === "resolved"
                                ? setResolving(defect.id)
                                : patch(defect.id, { status: to })
                            }
                          >
                            {ACTION_LABELS[to]}
                          </Action>
                        ))}
                        {next.length === 0 ? (
                          <span className="text-xs text-[var(--ink-faint)]">Closed</span>
                        ) : null}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Action({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-[var(--line-strong)] px-2 py-1 text-xs font-medium hover:bg-[var(--surface-sunken)] disabled:opacity-40"
    >
      {children}
    </button>
  );
}
