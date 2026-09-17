"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, inputStyle } from "@cityflow/ui";

const CONFIRMATION = "DELETE";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await fetch("/api/session", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  return (
    <Button tone="secondary" onClick={signOut} disabled={busy}>
      {busy ? "Signing out…" : "Sign out"}
    </Button>
  );
}

export function DeleteAccount({ cityId }: { cityId: string }) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Typed rather than a confirm dialog, because this is the one action in the product
  // that genuinely cannot be undone: the recovery phrase is hashed, so there is no copy
  // of the account anywhere to restore from.
  const armed = typed.trim().toUpperCase() === CONFIRMATION;

  async function remove() {
    if (!armed || busy) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/identity", { method: "DELETE" });
      if (!response.ok) {
        setError("Could not delete the account. Nothing has been removed.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Could not reach CityFlow. Nothing has been removed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-[var(--ink-muted)]">
        This removes {cityId}, every routine on it, every departure it was ever given and
        every point it earned. It cannot be undone, and the recovery phrase will not bring
        it back.
      </p>

      <label className="block text-sm" htmlFor="confirm-delete">
        Type {CONFIRMATION} to confirm
      </label>
      <input
        id="confirm-delete"
        className={`${inputStyle} max-w-xs font-mono uppercase`}
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        autoCapitalize="characters"
        spellCheck={false}
      />

      {error ? (
        <p role="alert" className="text-sm text-[var(--warn)]">
          {error}
        </p>
      ) : null}

      <Button tone="secondary" onClick={remove} disabled={!armed || busy}>
        {busy ? "Deleting…" : "Delete my account"}
      </Button>
    </div>
  );
}
