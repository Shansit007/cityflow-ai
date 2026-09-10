import type { BadgeTone } from "@/components/ui/badge";
import type { DemandLevel } from "@/lib/demand/demand-model";

/**
 * Mapping from a demand level to the design system's visual language.
 *
 * Kept in one file so the dashboard, the map legend and (from Phase 4) the
 * Admin Portal all colour the same level the same way. A user who learns that
 * amber means "moderate" on one screen should never meet a different rule on
 * another.
 */

export function demandBadgeTone(level: DemandLevel): BadgeTone {
  switch (level) {
    case "LOW":
      return "low";
    case "MODERATE":
      return "moderate";
    case "HIGH":
      return "high";
    case "VERY_HIGH":
      return "severe";
  }
}

/** Tailwind text colour class for a level. */
export function demandTextClass(level: DemandLevel): string {
  switch (level) {
    case "LOW":
      return "text-traffic-low";
    case "MODERATE":
      return "text-traffic-moderate";
    case "HIGH":
      return "text-traffic-high";
    case "VERY_HIGH":
      return "text-traffic-severe";
  }
}

/** Tailwind background class for bars and fills. */
export function demandBarClass(level: DemandLevel): string {
  switch (level) {
    case "LOW":
      return "bg-traffic-low";
    case "MODERATE":
      return "bg-traffic-moderate";
    case "HIGH":
      return "bg-traffic-high";
    case "VERY_HIGH":
      return "bg-traffic-severe";
  }
}

/** CSS custom property holding the level's colour, for inline SVG and Leaflet. */
export function demandColourVar(level: DemandLevel): string {
  switch (level) {
    case "LOW":
      return "var(--cf-traffic-low)";
    case "MODERATE":
      return "var(--cf-traffic-moderate)";
    case "HIGH":
      return "var(--cf-traffic-high)";
    case "VERY_HIGH":
      return "var(--cf-traffic-severe)";
  }
}

/**
 * The shape marker paired with each level.
 * Status is never communicated by colour alone — see the accessibility rules in
 * docs/DESIGN-SYSTEM.md.
 */
export function demandMarker(level: DemandLevel): string {
  switch (level) {
    case "LOW":
      return "●";
    case "MODERATE":
      return "▲";
    case "HIGH":
      return "◆";
    case "VERY_HIGH":
      return "■";
  }
}
