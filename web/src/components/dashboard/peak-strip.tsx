import { Card, CardHeader } from "@/components/ui/card";
import type { AdjustedDemandSlot } from "@/lib/demand/aggregate";
import { formatSlotLabel } from "@/lib/demand/time-slots";
import { demandBarClass, demandMarker, demandTextClass } from "@/lib/demand/ui";
import { cn } from "@/lib/utils";

/**
 * "Upcoming peak" — the shape of demand around the person's usual departure.
 *
 * This is the chart that makes the recommendation make sense: seeing that 9:00
 * is a spike and 8:45 is its shoulder explains the suggestion far better than
 * any sentence can.
 *
 * ACCESSIBILITY
 * The bars are decorative. Every slot also shows its level as text with a shape
 * marker, and a visually hidden summary lists the same numbers for screen
 * readers — nothing here depends on being able to compare bar heights or see
 * colour.
 */

interface PeakStripProps {
  slots: AdjustedDemandSlot[];
  /** The person's usual departure, highlighted in the strip. */
  usualDeparture: string;
  /** The recommended departure, also highlighted. */
  recommendedDeparture: string;
}

export function PeakStrip({ slots, usualDeparture, recommendedDeparture }: PeakStripProps) {
  if (slots.length === 0) {
    return (
      <Card>
        <CardHeader title="Upcoming demand" />
        <p className="text-sm text-muted">
          No demand information available for this time range.
        </p>
      </Card>
    );
  }

  // Scale against a fixed 100, not the local maximum: a quiet stretch of the day
  // should LOOK quiet, rather than being stretched to fill the chart.
  const maxIndex = 100;

  return (
    <Card>
      <CardHeader
        title="Upcoming demand"
        description="Predicted demand around your usual departure, in 15-minute slots."
      />

      {/* Bars ------------------------------------------------------------- */}
      <div className="flex h-32 items-end gap-1.5" aria-hidden="true">
        {slots.map((slot) => {
          const isUsual = slot.time === usualDeparture;
          const isRecommended = slot.time === recommendedDeparture;

          return (
            <div
              key={slot.minutes}
              className={cn(
                "flex-1 rounded-t-md transition-all",
                demandBarClass(slot.level),
                isRecommended || isUsual ? "opacity-100" : "opacity-60"
              )}
              style={{ height: `${Math.max(6, (slot.index / maxIndex) * 100)}%` }}
            />
          );
        })}
      </div>

      {/* Labels ----------------------------------------------------------- */}
      <div className="mt-2 flex gap-1.5" aria-hidden="true">
        {slots.map((slot) => {
          const isUsual = slot.time === usualDeparture;
          const isRecommended = slot.time === recommendedDeparture;

          return (
            <div key={slot.minutes} className="flex-1 text-center">
              <p
                className={cn(
                  "text-[0.6rem] leading-tight",
                  isRecommended || isUsual ? "font-semibold text-fg" : "text-subtle"
                )}
              >
                {formatSlotLabel(slot.minutes).replace(" AM", "").replace(" PM", "")}
              </p>
              <p className={cn("text-[0.6rem] leading-tight", demandTextClass(slot.level))}>
                {demandMarker(slot.level)}
              </p>
            </div>
          );
        })}
      </div>

      {/*
        How much of this curve is other people's confirmed plans rather than the
        baseline model. Saying so keeps the chart honest — and it is the visible
        evidence that confirmed decisions really do feed back into demand.
      */}
      {slots.some((slot) => slot.confirmedTrips > 0) && (
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs leading-relaxed text-muted">
          {slots.reduce((total, slot) => total + slot.confirmedTrips, 0)} confirmed
          {" "}travel plan
          {slots.reduce((total, slot) => total + slot.confirmedTrips, 0) === 1 ? "" : "s"}
          {" "}from CityFlow AI users are counted in this window, on top of the baseline
          prediction.
        </p>
      )}

      {/* Which bar is which ----------------------------------------------- */}
      <div className="mt-4 flex flex-wrap gap-4 border-t border-border-base pt-3 text-xs text-muted">
        <span>
          <span className="font-semibold text-fg">Recommended:</span>{" "}
          {formatSlotLabel(timeToMinutes(recommendedDeparture))}
        </span>
        <span>
          <span className="font-semibold text-fg">Usual:</span>{" "}
          {formatSlotLabel(timeToMinutes(usualDeparture))}
        </span>
      </div>

      {/* The same data, in words. */}
      <p className="sr-only-cf">
        Predicted demand by 15-minute slot:{" "}
        {slots
          .map((slot) => `${formatSlotLabel(slot.minutes)} ${slot.label}`)
          .join(", ")}
        .
      </p>
    </Card>
  );
}

/** Local helper: "08:45" -> 525. Kept private to avoid another import here. */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}
