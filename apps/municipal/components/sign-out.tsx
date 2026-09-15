"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/session", { method: "DELETE" });
      router.push("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className="text-[var(--ink-muted)] hover:text-[var(--ink)]"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
