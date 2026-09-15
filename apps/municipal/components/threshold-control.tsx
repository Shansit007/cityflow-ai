"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ThresholdControl({
  threshold,
  editable,
}: {
  threshold: number;
  editable: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(threshold));
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

  if (!editable) {
    return (
      <p className="text-xs leading-relaxed text-[#e7eef4]">
        A defect is Confirmed at <strong>{threshold}</strong> independent confirmations or
        more. The head of road maintenance sets this.
      </p>
    );
  }

  return (
    <form onSubmit={save} className="space-y-2">
      <label htmlFor="threshold" className="block text-xs text-[#e7eef4]">
        Confirmation threshold
      </label>
      <div className="flex gap-2">
        <input
          id="threshold"
          type="number"
          min="2"
          max="500"
          step="1"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="w-20 rounded border border-[#507694] bg-[#0b2f4e] px-2 py-1 text-sm tabular-nums text-white"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded border border-[#507694] px-2.5 py-1 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
      <p className="text-[11px] leading-relaxed text-[#c9d8e5]">
        Below it, Under Review. At or above, Confirmed and shown to crews.
      </p>
      {error ? (
        <p role="alert" className="text-[11px] text-[#ffc9a8]">
          {error}
        </p>
      ) : null}
    </form>
  );
}
