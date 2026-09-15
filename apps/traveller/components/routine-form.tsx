"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Field, inputStyle } from "@cityflow/ui";

import { CellPicker } from "@/components/cell-picker";
import type { Cell } from "@/lib/geohash";

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const MODES = [
  { value: "two_wheeler", label: "Two-wheeler" },
  { value: "car", label: "Car" },
  { value: "bus", label: "Bus" },
  { value: "metro", label: "Metro" },
  { value: "cycle", label: "Cycle" },
  { value: "walk", label: "Walk" },
];

const WEEKDAYS = [1, 2, 3, 4, 5];

export function RoutineForm() {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [origin, setOrigin] = useState<Cell | null>(null);
  const [destination, setDestination] = useState<Cell | null>(null);
  const [days, setDays] = useState<number[]>(WEEKDAYS);
  const [arriveBy, setArriveBy] = useState("09:30");
  const [mode, setMode] = useState("two_wheeler");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ready = Boolean(label.trim() && origin && destination && days.length);

  function toggleDay(day: number) {
    setDays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day],
    );
  }

  async function save() {
    if (!ready || !origin || !destination) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/routines", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          originCell: origin.hash,
          destinationCell: destination.hash,
          days,
          arriveBy,
          mode,
        }),
      });

      if (!response.ok) {
        setError("That routine could not be saved. Check the fields and try again.");
        return;
      }

      setLabel("");
      setOrigin(null);
      setDestination(null);
      router.refresh();
    } catch {
      setError("Could not reach CityFlow. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-xl space-y-5">
      <Field
        label="What is this journey?"
        htmlFor="label"
        hint="Something you will recognise on a list, like Office or School run."
      >
        <input
          id="label"
          value={label}
          maxLength={60}
          onChange={(event) => setLabel(event.target.value)}
          className={inputStyle}
        />
      </Field>

      <CellPicker id="origin" label="From" cell={origin} onChange={setOrigin} />
      <CellPicker
        id="destination"
        label="To"
        cell={destination}
        onChange={setDestination}
      />

      <fieldset>
        <legend className="text-sm font-medium">Which days</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {DAYS.map((day) => {
            const on = days.includes(day.value);
            return (
              <button
                key={day.value}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDay(day.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  on
                    ? "border-[var(--accent)] bg-[var(--accent-wash)] text-[var(--ink)]"
                    : "border-[var(--line-strong)] text-[var(--ink-muted)]"
                }`}
              >
                {day.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Arrive by"
          htmlFor="arrive-by"
          hint="The time that actually matters to you."
        >
          <input
            id="arrive-by"
            type="time"
            value={arriveBy}
            onChange={(event) => setArriveBy(event.target.value)}
            className={inputStyle}
          />
        </Field>
        <Field label="How you travel" htmlFor="mode">
          <select
            id="mode"
            value={mode}
            onChange={(event) => setMode(event.target.value)}
            className={inputStyle}
          >
            {MODES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-[var(--warn)]">
          {error}
        </p>
      ) : null}

      <Button onClick={save} disabled={!ready || busy}>
        {busy ? "Saving…" : "Save routine"}
      </Button>
    </Card>
  );
}
