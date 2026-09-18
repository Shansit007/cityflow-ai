"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

import type { DemandLevel } from "@/lib/demand/demand-model";

/**
 * The Leaflet map itself.
 *
 * WHY LEAFLET + OPENSTREETMAP
 * Both are free with no API key and no billing account, which is a hard
 * requirement for this project. OpenStreetMap is also the same road-network
 * source SUMO will use for simulation in Phase 4, so the map and the simulation
 * describe the same city.
 *
 * IMPORTANT: this component must only ever be rendered in the browser. Leaflet
 * touches `window` on import, so `map-panel.tsx` loads it with `ssr: false`.
 */

/** Colour per demand level, taken from the design system's traffic palette. */
const DEMAND_COLOUR: Record<DemandLevel, string> = {
  LOW: "var(--cf-traffic-low)",
  MODERATE: "var(--cf-traffic-moderate)",
  HIGH: "var(--cf-traffic-high)",
  VERY_HIGH: "var(--cf-traffic-severe)",
};

export interface MapMarker {
  id: string;
  lat: number;
  lon: number;
  title: string;
  description?: string;
  kind: "city" | "search" | "road-issue";
}

interface TrafficMapProps {
  center: { lat: number; lng: number };
  zoom: number;
  /** City-wide predicted demand, used to tint the overlay circle. */
  demandLevel: DemandLevel;
  demandLabel: string;
  cityName: string;
  markers: MapMarker[];
  /** When set, the map flies to this point. Used by the search box. */
  focus: { lat: number; lon: number } | null;
}

/**
 * Builds a marker icon from inline HTML.
 *
 * Leaflet's default marker loads three image files by relative path, which
 * breaks under any modern bundler. A `divIcon` sidesteps that entirely, ships
 * no image files at all, and inherits our theme colours.
 */
function buildIcon(kind: MapMarker["kind"]): L.DivIcon {
  const colour =
    kind === "road-issue"
      ? "var(--cf-road-attention)"
      : kind === "search"
        ? "var(--cf-secondary)"
        : "var(--cf-primary)";

  return L.divIcon({
    className: "cf-map-marker",
    html: `<span style="
      display:block;width:18px;height:18px;border-radius:50%;
      background:${colour};
      border:3px solid var(--cf-surface);
      box-shadow:0 1px 4px rgb(0 0 0 / 0.35);
    "></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

/** Moves the map when the selected city or a search result changes. */
function MapController({
  center,
  zoom,
  focus,
}: {
  center: { lat: number; lng: number };
  zoom: number;
  focus: { lat: number; lon: number } | null;
}) {
  const map = useMap();

  // Recentre when the user picks a different city.
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom);
  }, [map, center.lat, center.lng, zoom]);

  // Fly to a search result.
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lon], 14, { duration: 0.8 });
  }, [map, focus]);

  // Leaflet measures its container on creation. If the map is inside a card
  // that was still laying out, it can end up with the wrong size and render
  // grey stripes — this forces a re-measure once things have settled.
  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 200);
    return () => window.clearTimeout(timer);
  }, [map]);

  return null;
}

export default function TrafficMap({
  center,
  zoom,
  demandLevel,
  demandLabel,
  cityName,
  markers,
  focus,
}: TrafficMapProps) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      scrollWheelZoom={false}
      className="h-full w-full"
      // Keyboard users can pan the map with arrow keys.
      keyboard
    >
      {/*
        `cf-map-tiles` is what makes the map work in dark mode: globals.css
        applies a colour inversion to the tiles only, so labels stay legible
        without needing a second, paid tile provider.
      */}
      <TileLayer
        className="cf-map-tiles"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />

      {/*
        City-wide predicted demand, drawn honestly as ONE broad circle over the
        city rather than as fake road-level colouring. CityFlow AI predicts
        demand for the city and its time slots — it does not yet have per-road
        traffic data, and painting individual roads would imply that it does.
      */}
      <Circle
        center={[center.lat, center.lng]}
        radius={7000}
        pathOptions={{
          color: DEMAND_COLOUR[demandLevel],
          fillColor: DEMAND_COLOUR[demandLevel],
          fillOpacity: 0.12,
          weight: 2,
          dashArray: "6 6",
        }}
      >
        <Popup>
          <strong>{cityName}</strong>
          <br />
          Predicted demand right now: {demandLabel}
          <br />
          <span style={{ fontSize: "0.75rem", opacity: 0.75 }}>
            City-wide estimate, not a per-road measurement.
          </span>
        </Popup>
      </Circle>

      {markers.map((marker) => (
        <Marker
          key={marker.id}
          position={[marker.lat, marker.lon]}
          icon={buildIcon(marker.kind)}
        >
          <Popup>
            <strong>{marker.title}</strong>
            {marker.description && (
              <>
                <br />
                {marker.description}
              </>
            )}
          </Popup>
        </Marker>
      ))}

      <MapController center={center} zoom={zoom} focus={focus} />
    </MapContainer>
  );
}
