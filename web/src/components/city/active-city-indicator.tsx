"use client";

import { useCity } from "@/components/city/city-provider";
import { cn } from "@/lib/utils";

/**
 * Active city indicator.
 *
 * Read-only on purpose. The travel-plan form is the only place a person
 * picks a city by hand (see CityProvider's doc comment for the full
 * priority order) — this just shows what is active, wherever the header
 * used to offer a second way to change it.
 *
 * The only interactive part is "Use my location", which does not select a
 * city itself — it asks the browser for a position and lets CityProvider
 * resolve that to the nearest supported city. It only appears when location
 * has not already been granted, so it never crowds someone who is already
 * using it.
 */

interface ActiveCityIndicatorProps {
  /** "compact" for the header bar, "full" for the mobile drawer. */
  variant?: "compact" | "full";
  className?: string;
}

export function ActiveCityIndicator({ variant = "compact", className }: ActiveCityIndicatorProps) {
  const { city, locationStatus, requestLocation } = useCity();

  const fromLocation = locationStatus === "granted";
  const isDetecting = locationStatus === "detecting";
  const canOfferLocation =
    locationStatus === "idle" || locationStatus === "denied" || locationStatus === "unresolved";

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border-base bg-surface text-fg",
        variant === "compact" ? "h-10 px-3 text-sm" : "w-full px-3 py-2.5 text-sm",
        className
      )}
    >
      <PinIcon />

      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">
          {fromLocation ? "Current location" : "Current city"}: {city.name}
        </span>
        {variant === "full" && (
          <span className="block truncate text-xs text-subtle">
            Change your city from the travel plan form in your profile.
          </span>
        )}
      </span>

      {canOfferLocation && (
        <button
          type="button"
          onClick={requestLocation}
          disabled={isDetecting}
          className="shrink-0 whitespace-nowrap text-xs font-medium text-primary hover:underline disabled:opacity-60"
        >
          {isDetecting ? "Locating…" : "Use my location"}
        </button>
      )}
    </div>
  );
}

function PinIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-secondary"
    >
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}
