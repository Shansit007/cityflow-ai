"use client";

import { useState } from "react";

/**
 * Shows the user's anonymous CityFlow ID with a "copy" button.
 *
 * This is a client component only because copying to the clipboard needs the
 * browser. The ID itself is passed down from the server.
 */
export function CityflowIdCard({ cityflowId }: { cityflowId: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(cityflowId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked; the ID is visible on screen anyway.
      setCopied(false);
    }
  }

  return (
    <div className="rounded-card border border-border-base bg-surface-2 p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-subtle">
        Your CityFlow ID
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <p className="font-mono text-2xl font-semibold tracking-wider text-primary sm:text-3xl">
          {cityflowId}
        </p>

        <button
          type="button"
          onClick={handleCopy}
          className="rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-xs font-medium text-fg transition-colors hover:bg-surface-3"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-muted">
        This ID helps connect your travel preferences and recommendations without
        unnecessarily exposing your identity.
      </p>
    </div>
  );
}
