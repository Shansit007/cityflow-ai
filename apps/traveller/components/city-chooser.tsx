"use client";

import { useState } from "react";
import { Button } from "@cityflow/ui";

import { CityBackdrop } from "@/components/city-backdrop";
import { CITIES, DEFAULT_CITY } from "@/lib/cities";

/**
 * Pick a city, and the page becomes that city.
 *
 * The backdrop is rendered from here rather than from the page so it can follow the
 * selection before anything is submitted: choosing Jaipur should look like choosing
 * Jaipur, not like filling in a form field. It is fixed-position, so living inside this
 * component costs nothing in layout terms.
 */
export function CityChooser() {
  const [city, setCity] = useState(DEFAULT_CITY);

  return (
    <>
      <CityBackdrop city={city} />

      <form action="/join" method="get" className="mt-8 flex flex-wrap gap-3">
        <label htmlFor="city" className="sr-only">
          Your city
        </label>
        <select
          id="city"
          name="city"
          value={city}
          onChange={(event) => setCity(event.target.value)}
          className="rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--surface-raised)] px-3 py-2.5 text-sm"
        >
          {CITIES.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
        </select>
        <Button type="submit">Get your City ID</Button>
      </form>
    </>
  );
}
