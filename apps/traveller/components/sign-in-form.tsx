"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, inputStyle } from "@cityflow/ui";

import { isValidCityId, normaliseRecoveryCode } from "@/lib/city-id";

export function SignInForm() {
  const router = useRouter();
  const [cityId, setCityId] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ready = isValidCityId(cityId.trim().toUpperCase()) && recoveryCode.trim() !== "";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;

    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cityId: cityId.trim().toUpperCase(),
          // The server normalises too. Doing it here as well means someone who pasted
          // their phrase with the dashes stripped sees it accepted rather than rejected
          // for a reason the form never explains.
          recoveryCode: normaliseRecoveryCode(recoveryCode),
        }),
      });

      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const message =
          body && typeof body === "object" && "error" in body
            ? String((body as { error: unknown }).error)
            : "That City ID and recovery phrase do not match.";
        setError(message);
        return;
      }

      router.push("/today");
      router.refresh();
    } catch {
      setError("Could not reach CityFlow. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 max-w-md space-y-5">
      <Field label="Your City ID" htmlFor="city-id">
        <input
          id="city-id"
          className={`${inputStyle} font-mono uppercase`}
          value={cityId}
          onChange={(event) => setCityId(event.target.value)}
          placeholder="BLR-7X3K-9QMN"
          autoComplete="username"
          autoCapitalize="characters"
          spellCheck={false}
          required
        />
      </Field>

      <Field label="Recovery phrase" htmlFor="recovery">
        <input
          id="recovery"
          className={`${inputStyle} font-mono uppercase`}
          value={recoveryCode}
          onChange={(event) => setRecoveryCode(event.target.value)}
          placeholder="2WTZ-EQT3-X7FY-Z9DQ-6Y4A-U4G2"
          autoComplete="current-password"
          autoCapitalize="characters"
          spellCheck={false}
          required
        />
      </Field>

      {error ? (
        <p role="alert" className="text-sm text-[var(--warn)]">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={!ready || busy}>
        {busy ? "Checking…" : "Sign in"}
      </Button>
    </form>
  );
}
