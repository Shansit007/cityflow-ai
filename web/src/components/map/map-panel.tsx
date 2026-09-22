"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

import { useCity } from "@/components/city/city-provider";
import type { MapMarker } from "@/components/map/traffic-map";
import { Badge } from "@/components/ui/badge";
import type { DemandLevel } from "@/lib/demand/demand-model";
import { demandBadgeTone } from "@/lib/demand/ui";
import { cn } from "@/lib/utils";

/**
 * The map card: search box, map, legend.
 *
 * Leaflet cannot be server-rendered (it reaches for `window` as soon as it is
 * imported), so the map itself is loaded only in the browser. Everything around
 * it — the search box, the legend, the loading and error states — is ordinary
 * React and renders immediately.
 */

const TrafficMap = dynamic(() => import("@/components/map/traffic-map"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

interface MapPanelProps {
  demandLevel: DemandLevel;
  demandLabel: string;
  /** Extra markers, e.g. road issues once Phase 5 supplies them. */
  markers?: MapMarker[];
}

interface SearchResult {
  label: string;
  lat: number;
  lon: number;
}

export function MapPanel({ demandLevel, demandLabel, markers = [] }: MapPanelProps) {
  const { city } = useCity();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lon: number } | null>(null);
  const [searchMarker, setSearchMarker] = useState<MapMarker | null>(null);

  // Cancels an in-flight search when the person keeps typing.
  const abortRef = useRef<AbortController | null>(null);

  // Changing city clears any previous search — the results would be elsewhere.
  useEffect(() => {
    setQuery("");
    setResults([]);
    setFocus(null);
    setSearchMarker(null);
  }, [city.code]);

  /**
   * Debounced search. Waiting 500ms after the last keystroke keeps us well
   * inside OpenStreetMap's free usage policy and avoids a request per letter.
   */
  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 3) {
      setResults([]);
      setSearchError(null);
      return;
    }

    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setSearching(true);
      setSearchError(null);

      try {
        const response = await fetch(
          `/api/geocode?q=${encodeURIComponent(trimmed)}&city=${encodeURIComponent(city.name)}`,
          { signal: controller.signal }
        );
        const data = await response.json();

        setResults(data.results ?? []);
        if (data.error) setSearchError(data.error);
        else if ((data.results ?? []).length === 0) {
          setSearchError(`No places found for “${trimmed}”.`);
        }
      } catch (error) {
        // An aborted request is expected while typing — not an error to show.
        if ((error as Error).name !== "AbortError") {
          setSearchError("Place search is unavailable right now.");
        }
      } finally {
        setSearching(false);
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [query, city.name]);

  function pickResult(result: SearchResult) {
    setFocus({ lat: result.lat, lon: result.lon });
    setSearchMarker({
      id: "search-result",
      lat: result.lat,
      lon: result.lon,
      title: result.label.split(",")[0],
      description: result.label,
      kind: "search",
    });
    setResults([]);
    setQuery(result.label.split(",")[0]);
  }

  const allMarkers = useMemo(
    () => (searchMarker ? [...markers, searchMarker] : markers),
    [markers, searchMarker]
  );

  return (
    <div className="overflow-hidden rounded-card border border-border-base bg-surface shadow-card">
      {/* ------------------------------------------------------------ header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-base p-4">
        <div>
          <h2 className="text-base font-semibold text-fg">{city.name} map</h2>
          <p className="text-xs text-muted">
            OpenStreetMap base layer · city-wide predicted demand
          </p>
        </div>

        <Badge tone={demandBadgeTone(demandLevel)}>{demandLabel} demand now</Badge>
      </div>

      {/* ------------------------------------------------------------ search */}
      <div className="relative border-b border-border-base p-4">
        <label htmlFor="map-search" className="sr-only-cf">
          Search for a place in {city.name}
        </label>
        <input
          id="map-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search a place in ${city.name}…`}
          className="h-10 w-full rounded-lg border border-border-strong bg-surface-2 px-3 text-sm text-fg placeholder:text-subtle"
          autoComplete="off"
        />

        {searching && <p className="mt-2 text-xs text-subtle">Searching…</p>}
        {searchError && !searching && (
          <p className="mt-2 text-xs text-muted">{searchError}</p>
        )}

        {results.length > 0 && (
          <ul className="absolute left-4 right-4 top-[3.75rem] z-[500] max-h-56 overflow-y-auto rounded-lg border border-border-base bg-surface shadow-float">
            {results.map((result) => (
              <li key={`${result.lat},${result.lon}`}>
                <button
                  type="button"
                  onClick={() => pickResult(result)}
                  className="block w-full px-3 py-2.5 text-left text-sm text-fg hover:bg-surface-2"
                >
                  {result.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* --------------------------------------------------------------- map */}
      <div className="h-[22rem] w-full sm:h-[26rem]">
        <TrafficMap
          center={city.center}
          zoom={city.zoom}
          demandLevel={demandLevel}
          demandLabel={demandLabel}
          cityName={city.name}
          markers={allMarkers}
          focus={focus}
        />
      </div>

      {/* ------------------------------------------------------------ legend */}
      <div className="border-t border-border-base p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">
          Legend
        </p>

        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <LegendItem colour="var(--cf-traffic-low)" label="Low demand" marker="●" />
          <LegendItem colour="var(--cf-traffic-moderate)" label="Moderate" marker="▲" />
          <LegendItem colour="var(--cf-traffic-high)" label="High" marker="◆" />
          <LegendItem colour="var(--cf-traffic-severe)" label="Very high" marker="■" />
          <LegendItem colour="var(--cf-secondary)" label="Search result" marker="●" />
          <LegendItem
            colour="var(--cf-road-attention)"
            label="Possible road issue"
            marker="●"
          />
        </div>

        <p className="mt-3 text-xs text-subtle">
          City-wide prediction, not per-road ·{" "}
          <Link href="/how-it-works#how-numbers-work" className="underline underline-offset-2">
            how this works
          </Link>
        </p>
      </div>
    </div>
  );
}

function LegendItem({
  colour,
  label,
  marker,
}: {
  colour: string;
  label: string;
  marker: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted">
      {/* Colour plus a shape, so the legend is readable without colour vision. */}
      <span aria-hidden="true" style={{ color: colour }} className="text-[0.7rem]">
        {marker}
      </span>
      {label}
    </span>
  );
}

/** Shown while the map bundle downloads. */
function MapSkeleton() {
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center bg-surface-2",
        "animate-pulse"
      )}
      aria-busy="true"
    >
      <p className="text-sm text-subtle">Loading map…</p>
    </div>
  );
}
