"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useEffect, useRef } from "react";

import { confirmationOf, priorityOf, type Priority } from "@/lib/classify";

/**
 * OpenFreeMap serves OpenStreetMap vector tiles with no key and no quota. The spec
 * rules out Google Maps and it is not a cost question: a map behind a billing account
 * is a map a reviewer cannot open, and a municipal tool should not depend on one.
 * MapLibre pulls the OSM attribution out of the style itself, which is the licence
 * condition, so nothing here may remove the control.
 */
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

const COLOURS: Record<Priority, string> = {
  Critical: "#c62f1d",
  High: "#b4690e",
  Medium: "#8a7a0a",
  Review: "#1e5fa8",
};

export interface MapDefect {
  id: string;
  reference: string;
  lat: number;
  lon: number;
  ward: number | null;
  confirmations: number;
  assignee: string | null;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
}

export function DefectMap({
  defects,
  threshold,
  selectedId,
  height = 420,
}: {
  defects: MapDefect[];
  threshold: number;
  selectedId?: string;
  height?: number;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = container.current;
    if (!element || defects.length === 0) return;

    let cancelled = false;
    let map: { remove: () => void } | undefined;

    // Imported inside the effect rather than at module scope: maplibre reaches for
    // window as it loads, and this component is rendered from a server component.
    void (async () => {
      const { LngLatBounds, Map, Marker, NavigationControl, Popup } =
        await import("maplibre-gl");
      if (cancelled) return;

      const instance = new Map({
        container: element,
        style: STYLE_URL,
        center: [defects[0]!.lon, defects[0]!.lat],
        zoom: 11,
        attributionControl: { compact: true },
      });
      map = instance;

      instance.addControl(new NavigationControl({ showCompass: false }));
      instance.scrollZoom.disable();

      const bounds = new LngLatBounds();
      for (const defect of defects) {
        bounds.extend([defect.lon, defect.lat]);

        const priority = priorityOf(defect.confirmations, threshold);
        const selected = defect.id === selectedId;

        const pin = document.createElement("div");
        pin.style.cssText = [
          `width:${selected ? 20 : 13}px`,
          `height:${selected ? 20 : 13}px`,
          "border-radius:50%",
          `background:${COLOURS[priority]}`,
          `border:${selected ? 3 : 2}px solid #fff`,
          "box-shadow:0 0 0 1px rgba(0,0,0,.25)",
          "cursor:pointer",
        ].join(";");
        pin.setAttribute("aria-label", `${defect.reference}, ${priority}`);

        const popup = new Popup({ offset: 14, closeButton: false }).setHTML(
          `<div style="font:13px/1.45 system-ui,sans-serif;min-width:190px">
             <strong>${escapeHtml(defect.reference)}</strong><br>
             ${defect.ward ? `Ward ${defect.ward}<br>` : ""}
             <b>${defect.confirmations}</b> confirmations<br>
             ${escapeHtml(confirmationOf(defect.confirmations, threshold))} &middot;
             ${escapeHtml(priority)}<br>
             ${escapeHtml(defect.assignee ?? "Nobody assigned")}
           </div>`,
        );

        new Marker({ element: pin })
          .setLngLat([defect.lon, defect.lat])
          .setPopup(popup)
          .addTo(instance);
      }

      if (defects.length > 1) {
        instance.fitBounds(bounds, { padding: 48, animate: false, maxZoom: 15 });
      } else {
        instance.setZoom(15);
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [defects, threshold, selectedId]);

  if (defects.length === 0) {
    return (
      <p className="rounded-[var(--radius)] border border-dashed border-[var(--line-strong)] p-6 text-sm text-[var(--ink-muted)]">
        No reports to place on the map yet.
      </p>
    );
  }

  return (
    <div
      ref={container}
      style={{ height }}
      className="w-full overflow-hidden rounded-[var(--radius)] border border-[var(--line)]"
    />
  );
}
