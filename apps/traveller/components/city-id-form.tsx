"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, inputStyle } from "@cityflow/ui";

import { generateCityId, generateRecoveryCode } from "@/lib/city-id";

interface Credentials {
  cityId: string;
  recoveryCode: string;
  checkIndex: number;
}

function mint(cityCode: string): Credentials {
  const recoveryCode = generateRecoveryCode();
  return {
    cityId: generateCityId(cityCode),
    recoveryCode,
    // Which group we will ask for back. Chosen here rather than at the prompt so the
    // question cannot change while somebody is answering it.
    checkIndex: Math.floor(Math.random() * recoveryCode.split("-").length),
  };
}

export function CityIdForm({
  cityCode,
  cityName,
}: {
  cityCode: string;
  cityName: string;
}) {
  const router = useRouter();
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!credentials) {
    return (
      <div className="mt-8">
        <Button onClick={() => setCredentials(mint(cityCode))}>
          Generate my City ID
        </Button>
      </div>
    );
  }

  const groups = credentials.recoveryCode.split("-");
  const expected = groups[credentials.checkIndex]!;
  const matches = typed.trim().toUpperCase() === expected;

  async function claim() {
    if (!credentials || !matches) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/identity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cityId: credentials.cityId,
          recoveryCode: credentials.recoveryCode,
          homeCity: cityCode,
        }),
      });

      if (response.status === 409) {
        // Two browsers picked the same ID. Nothing the traveller did, and nothing they
        // should have to read about: mint another and let them confirm it again.
        setCredentials(mint(cityCode));
        setTyped("");
        setError("That ID was just taken. Here is another one.");
        return;
      }

      if (!response.ok) {
        setError("Could not create the account. Try again in a moment.");
        return;
      }

      router.push("/today");
    } catch {
      setError("Could not reach CityFlow. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <div>
        <h2 className="text-sm font-medium text-[var(--ink-muted)]">
          Your City ID for {cityName}
        </h2>
        <p className="mt-1 font-mono text-xl tracking-wider">{credentials.cityId}</p>
      </div>

      <div className="rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--accent-wash)] p-4">
        <h2 className="text-sm font-semibold">Recovery phrase</h2>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          Shown once. Write it down or put it in a password manager now.
        </p>
        <p className="mt-3 select-all break-words font-mono text-base tracking-wider">
          {credentials.recoveryCode}
        </p>
      </div>

      <Field
        label={`Type group ${credentials.checkIndex + 1} of your recovery phrase`}
        htmlFor="check"
        hint="Confirming you have it somewhere other than this screen."
        error={error ?? undefined}
      >
        <input
          id="check"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          maxLength={8}
          className={`${inputStyle} font-mono uppercase tracking-wider`}
        />
      </Field>

      <Button onClick={claim} disabled={!matches || busy}>
        {busy ? "Creating…" : "Create my account"}
      </Button>
    </div>
  );
}
