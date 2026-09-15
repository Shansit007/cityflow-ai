"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ThresholdControl({ threshold }: { threshold: number }) {
  const router = useRouter();
  const [value, setValue] = useState(threshold.toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ threshold: Number(value) }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? "That threshold was refused.");
        return;
      }

      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-wrap items-center gap-2 text-xs">
      <label htmlFor="threshold" className="text-[var(--ink-muted)]">
        Priority at or above
      </label>
      <input
        id="threshold"
        type="number"
        min="0"
        max="1"
        step="0.05"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="w-20 rounded border border-[var(--line-strong)] bg-[var(--surface-raised)] px-2 py-1 tabular-nums"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded border border-[var(--line-strong)] px-2 py-1 font-medium disabled:opacity-40"
      >
        {busy ? "Saving…" : "Save"}
      </button>
      {error ? (
        <span role="alert" className="text-[var(--warn)]">
          {error}
        </span>
      ) : null}
    </form>
  );
}
