"use client";

import { useCity } from "@/components/city/city-provider";
import { CitySkyline } from "@/components/city/city-skyline";
import { cn } from "@/lib/utils";

/**
 * The city-aware background used behind hero areas and page headers.
 *
 * DESIGN RULES THIS COMPONENT ENFORCES
 *  1. The illustration is decoration, never content — it sits behind everything
 *     and is marked aria-hidden so screen readers skip it.
 *  2. Readability wins. A theme-aware scrim is layered on top, and the artwork
 *     itself fades out towards the top where the headline sits.
 *  3. It is subtle. Overall opacity is driven by `--cf-backdrop-opacity`, which
 *     is lower in dark mode where the same artwork would otherwise feel loud.
 */

interface CityBackdropProps {
  /** How tall the illustration area is. */
  height?: "sm" | "md" | "lg";
  className?: string;
}

const HEIGHT_CLASSES = {
  sm: "h-40 sm:h-52",
  md: "h-64 sm:h-80",
  lg: "h-80 sm:h-[26rem]",
} as const;

export function CityBackdrop({ height = "md", className }: CityBackdropProps) {
  const { city } = useCity();

  return (
    <div
      className={cn("pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden", className)}
      // Described for assistive technology on the parent section instead.
      aria-hidden="true"
    >
      <div
        className={cn("relative w-full", HEIGHT_CLASSES[height])}
        // Overall strength of the artwork. Dark mode uses a lower value so the
        // same drawing does not glow against a dark page.
        style={{ opacity: "var(--cf-backdrop-opacity)" }}
      >
        <CitySkyline city={city.code} className="absolute inset-0 h-full w-full" />

        {/* Scrim: guarantees text contrast no matter how busy the drawing is. */}
        <div className="absolute inset-0 bg-gradient-to-b from-bg via-bg/55 to-bg/80" />
      </div>
    </div>
  );
}
