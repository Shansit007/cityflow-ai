"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice, TextField } from "@/components/ui/input";
import { EmptyNote } from "@/components/admin/panels";
import type { City } from "@/lib/cities";
import type { MunicipalOfficer } from "@/lib/admin/municipal-access";
import { fieldErrorsFrom, grantMunicipalAccessSchema } from "@/lib/validation";

interface MunicipalAccessManagerProps {
  initialOfficers: MunicipalOfficer[];
  cities: City[];
}

const EMPTY = { email: "", cityCode: "" };

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

/**
 * Admin-only screen: grant or revoke Municipal Dashboard access, one city at
 * a time, by email of an account that already exists.
 *
 * This is the same trusted action `npm run role:set -- email MUNICIPAL` used
 * to be, just reachable from the Admin Portal instead of a terminal. It can
 * never touch an Admin account -- see lib/admin/municipal-access.ts.
 */
export function MunicipalAccessManager({ initialOfficers, cities }: MunicipalAccessManagerProps) {
  const router = useRouter();

  const [officers, setOfficers] = useState(initialOfficers);
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [granted, setGranted] = useState<string | null>(null);
  const [granting, setGranting] = useState(false);

  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);

  function update(patch: Partial<typeof EMPTY>) {
    setGranted(null);
    setValues((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setGranted(null);

    const parsed = grantMunicipalAccessSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      setFormError("Please check the highlighted fields.");
      return;
    }

    setGranting(true);
    try {
      const response = await fetch("/api/admin/municipal-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const data = await response.json();

      if (!response.ok) {
        setFormError(data.error ?? "Could not grant municipal access.");
        if (data.fieldErrors) setErrors(data.fieldErrors);
        return;
      }

      const officer = data.officer as MunicipalOfficer;
      setOfficers((current) => [
        officer,
        ...current.filter((row) => row.email !== officer.email),
      ]);
      setValues(EMPTY);
      setGranted(`${officer.email} now has municipal access for ${officer.cityName}.`);
      router.refresh();
    } catch {
      setFormError("Could not reach the server. Please try again.");
    } finally {
      setGranting(false);
    }
  }

  async function handleRevoke(email: string) {
    setRevokeError(null);
    setBusyEmail(email);

    try {
      const response = await fetch("/api/admin/municipal-access", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setRevokeError(data.error ?? "Could not revoke municipal access.");
        return;
      }

      setOfficers((current) => current.filter((row) => row.email !== email));
      router.refresh();
    } catch {
      setRevokeError("Could not reach the server. Please try again.");
    } finally {
      setBusyEmail(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Grant municipal access"
          description="The account must already exist -- they sign up on CityFlow AI first, then you assign them here. This can never be used to grant Admin."
        />

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {formError && <Notice tone="error">{formError}</Notice>}
          {granted && <Notice tone="success">{granted}</Notice>}

          <TextField
            label="Email"
            type="email"
            required
            value={values.email}
            onChange={(event) => update({ email: event.target.value })}
            error={errors.email}
            placeholder="officer@example.com"
          />

          <div>
            <label htmlFor="municipal-city" className="mb-1.5 block text-sm font-medium text-fg">
              City
              <span className="ml-1 text-danger" aria-hidden="true">
                *
              </span>
            </label>
            <select
              id="municipal-city"
              value={values.cityCode}
              onChange={(event) => update({ cityCode: event.target.value })}
              className="h-11 w-full rounded-lg border border-border-base bg-surface px-3 text-sm text-fg"
            >
              <option value="">Choose a city…</option>
              {cities.map((city) => (
                <option key={city.code} value={city.code}>
                  {city.name} ({city.state})
                </option>
              ))}
            </select>
            {errors.cityCode && (
              <p className="mt-1.5 text-xs text-danger" role="alert">
                {errors.cityCode}
              </p>
            )}
          </div>

          <Button type="submit" loading={granting} size="lg">
            Grant access
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Current municipal officers"
          description="Every account with municipal access right now, across every city."
        />

        {revokeError && <Notice tone="error">{revokeError}</Notice>}

        {officers.length === 0 ? (
          <EmptyNote>No account currently has municipal access.</EmptyNote>
        ) : (
          <ul className="divide-y divide-border-base">
            {officers.map((officer) => (
              <li
                key={officer.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-fg">{officer.email}</p>
                  <p className="mt-0.5 text-xs text-subtle">
                    <Badge tone="secondary">{officer.cityName}</Badge>{" "}
                    <span className="font-mono">{officer.cityflowId}</span> · granted{" "}
                    {formatDate(officer.createdAt)}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  loading={busyEmail === officer.email}
                  onClick={() => handleRevoke(officer.email)}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
