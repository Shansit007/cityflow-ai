"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Role } from "@/lib/session";
import { allowedTransitions, type DefectStatus } from "@/lib/transitions";

const ACTION_LABELS: Record<DefectStatus, string> = {
  reported: "Reopen",
  triaged: "Triage",
  assigned: "Assign",
  in_progress: "Start work",
  resolved: "Resolve",
  rejected: "Reject",
};

export function DefectActions({
  defectId,
  status,
  role,
}: {
  defectId: string;
  status: DefectStatus;
  role: Role;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const next = allowedTransitions(role, status);

  async function move(to: DefectStatus) {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/defects/${defectId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: to, note: to === "resolved" ? note : null }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? "That change was refused.");
        return;
      }

      setResolving(false);
      setNote("");
      router.refresh();
    } catch {
      setError("Could not reach the server. This report may be out of date.");
    } finally {
      setBusy(false);
    }
  }

  if (next.length === 0) {
    return <p className="text-xs text-[var(--ink-faint)]">This report is closed.</p>;
  }

  return (
    <div className="space-y-2">
      {resolving ? (
        <div className="space-y-2">
          <label htmlFor="note" className="block text-xs font-semibold">
            What was done?
          </label>
          <textarea
            id="note"
            rows={3}
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="w-full rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--surface-raised)] px-2 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <Action disabled={busy || !note.trim()} onClick={() => move("resolved")}>
              Save and resolve
            </Action>
            <Action onClick={() => setResolving(false)}>Cancel</Action>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {next.map((to) => (
            <Action
              key={to}
              disabled={busy}
              onClick={() => (to === "resolved" ? setResolving(true) : move(to))}
            >
              {ACTION_LABELS[to]}
            </Action>
          ))}
        </div>
      )}

      {error ? (
        <p role="alert" className="text-xs text-[var(--warn)]">
          {error}
        </p>
      ) : null}
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
      className="rounded-[var(--radius)] border border-[var(--line-strong)] px-2.5 py-1.5 text-xs font-semibold hover:bg-[var(--surface-sunken)] disabled:opacity-40"
    >
      {children}
    </button>
  );
}
