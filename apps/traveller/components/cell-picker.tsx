"use client";

import { useState } from "react";
import { Button, Field, inputStyle } from "@cityflow/ui";

import { cellFor, cellSize, type Cell } from "@/lib/geohash";

interface CellPickerProps {
  id: string;
  label: string;
  cell: Cell | null;
  onChange: (cell: Cell | null) => void;
}

/**
 * Picks a place and immediately throws away the precision.
 *
 * The coordinate is coarsened to a geohash cell here, in the browser, and only the
 * cell leaves. Showing the cell and its size is the point: the privacy claim is
 * visible in the interface rather than asserted in a policy nobody opens.
 */
export function CellPicker({ id, label, cell, onChange }: CellPickerProps) {
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function apply(lat: number, lon: number) {
    try {
      onChange(cellFor(lat, lon));
      setError(null);
    } catch {
      setError("Those coordinates are not on the map.");
      onChange(null);
    }
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      setError("This browser cannot share a location. Enter coordinates instead.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setLatitude(position.coords.latitude.toFixed(5));
        setLongitude(position.coords.longitude.toFixed(5));
        apply(position.coords.latitude, position.coords.longitude);
      },
      () => {
        setLocating(false);
        setError("Location was not shared. Enter coordinates instead.");
      },
      { maximumAge: 300_000, timeout: 10_000 },
    );
  }

  const size = cell ? cellSize(cell) : null;

  return (
    <fieldset className="rounded-[var(--radius)] border border-[var(--line)] p-4">
      <legend className="px-1 text-sm font-medium">{label}</legend>

      <Button tone="secondary" type="button" onClick={locate} disabled={locating}>
        {locating ? "Locating…" : "Use my current location"}
      </Button>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Latitude" htmlFor={`${id}-lat`}>
          <input
            id={`${id}-lat`}
            inputMode="decimal"
            value={latitude}
            placeholder="12.97160"
            onChange={(event) => {
              setLatitude(event.target.value);
              const lat = Number(event.target.value);
              const lon = Number(longitude);
              if (event.target.value && longitude) apply(lat, lon);
            }}
            className={inputStyle}
          />
        </Field>
        <Field label="Longitude" htmlFor={`${id}-lon`}>
          <input
            id={`${id}-lon`}
            inputMode="decimal"
            value={longitude}
            placeholder="77.59460"
            onChange={(event) => {
              setLongitude(event.target.value);
              const lat = Number(latitude);
              const lon = Number(event.target.value);
              if (latitude && event.target.value) apply(lat, lon);
            }}
            className={inputStyle}
          />
        </Field>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-xs text-[var(--warn)]">
          {error}
        </p>
      ) : null}

      {cell && size ? (
        <p className="mt-3 text-xs text-[var(--ink-muted)]">
          Stored as cell <span className="font-mono">{cell.hash}</span>, about{" "}
          {size.width} m by {size.height} m. The coordinates above stay in this browser.
        </p>
      ) : null}
    </fieldset>
  );
}
