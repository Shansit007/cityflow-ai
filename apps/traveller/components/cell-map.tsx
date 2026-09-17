"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";

import type { Cell } from "@/lib/geohash";

// OpenFreeMap serves OpenStreetMap vector tiles with no key, no account and no quota.
// The alternative every tutorial reaches for bills per thousand loads, and this project
// has to stay free to run for it to be worth anything to a city that has no budget.
const STYLE = "https://tiles.openfreemap.org/styles/liberty";

const CELL_SOURCE = "picked-cell";

interface CellMapProps {
  centre: { lat: number; lon: number };
  cell: Cell | null;
  onPick: (lat: number, lon: number) => void;
  label: string;
}

function outline(cell: Cell) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "Polygon" as const,
      coordinates: [
        [
          [cell.west, cell.south],
          [cell.east, cell.south],
          [cell.east, cell.north],
          [cell.west, cell.north],
          [cell.west, cell.south],
        ],
      ],
    },
  };
}

/**
 * Pick a place by tapping, and see the box that is actually stored.
 *
 * The marker is not where the pin went: it is the cell the pin fell into, which is the
 * only thing that leaves the browser. Drawing it is the point. A privacy claim written
 * in a policy is a promise, and a privacy claim you can see the size of is a fact.
 */
export function CellMap({ centre, cell, onPick, label }: CellMapProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const node = container.current;
    if (!node) return;

    // Imported here rather than at the top of the module: maplibre touches window as it
    // loads, and this component is rendered on the server before it reaches a browser.
    void (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        await import("maplibre-gl/dist/maplibre-gl.css");
        if (cancelled) return;

        const instance = new maplibre.Map({
          container: node,
          style: STYLE,
          center: [centre.lon, centre.lat],
          zoom: 12,
          attributionControl: { compact: true },
        });

        instance.addControl(new maplibre.NavigationControl({ showCompass: false }));
        instance.on("click", (event) => {
          onPick(event.lngLat.lat, event.lngLat.lng);
        });
        instance.on("load", () => {
          instance.addSource(CELL_SOURCE, {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          instance.addLayer({
            id: `${CELL_SOURCE}-fill`,
            type: "fill",
            source: CELL_SOURCE,
            paint: { "fill-color": "#2a78d6", "fill-opacity": 0.18 },
          });
          instance.addLayer({
            id: `${CELL_SOURCE}-line`,
            type: "line",
            source: CELL_SOURCE,
            paint: { "line-color": "#2a78d6", "line-width": 2 },
          });
        });

        map.current = instance;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // Deliberately built once, with no dependencies. The centre is a starting view
    // rather than a controlled value, so rebuilding the map when it changes would drag
    // the view out from under someone who is mid-pan.
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;

    const draw = () => {
      const source = instance.getSource<GeoJSONSource>(CELL_SOURCE);
      if (!source) return;
      source.setData(
        cell
          ? { type: "FeatureCollection", features: [outline(cell)] }
          : { type: "FeatureCollection", features: [] },
      );
    };

    if (instance.isStyleLoaded()) draw();
    else instance.once("load", draw);
  }, [cell]);

  if (failed) {
    return (
      <p className="text-sm text-[var(--ink-muted)]">
        The map could not load. Enter coordinates instead — it changes nothing about what
        is stored.
      </p>
    );
  }

  return (
    <div
      ref={container}
      role="application"
      aria-label={label}
      className="h-64 w-full overflow-hidden rounded-[var(--radius)] border border-[var(--line)]"
    />
  );
}
