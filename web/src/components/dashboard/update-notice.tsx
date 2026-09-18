"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * "Your recommendation has been updated" — the notification the product
 * promised in Phase 3.
 *
 * It appears when the city-wide optimiser moved this person's recommended time
 * because other people's confirmed plans changed the demand picture. It always
 * explains WHY, and it never changes anything on its own: the new time is a
 * suggestion like any other, and the person can ignore it.
 *
 * It stays visible until it is explicitly dismissed, so a notice cannot be
 * "read" by a page that merely loaded in a pocket.
 */
export function UpdateNotice({ reason }: { reason: string }) {
  const router = useRouter();
  const [dismissing, setDismissing] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  async function dismiss() {
    setDismissing(true);
    try {
      await fetch("/api/recommendation/acknowledge", { method: "POST" });
      setHidden(true);
      router.refresh();
    } finally {
      setDismissing(false);
    }
  }

  return (
    <div
      role="status"
      className="rounded-card border-l-4 border-l-secondary border-y border-r border-border-base bg-secondary-soft/40 p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg">
            Your recommendation has been updated
          </p>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{reason}</p>
          <p className="mt-2 text-xs leading-relaxed text-subtle">
            This is still only a suggestion. If your usual time suits you better, keep it —
            nothing is changed for you automatically.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={dismiss} loading={dismissing}>
          Got it
        </Button>
      </div>
    </div>
  );
}
