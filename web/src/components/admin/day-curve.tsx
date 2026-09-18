import { Card, CardHeader } from "@/components/ui/card";
import type { AdjustedDemandSlot } from "@/lib/demand/aggregate";
import { formatSlotLabel } from "@/lib/demand/time-slots";
import { cn } from "@/lib/utils";

/**
 * Predicted demand across the whole reporting day.
 *
 * FORM: magnitude over time, one measure → a bar chart.
 *
 * COLOUR: one series, so one colour. The only second colour is for slots at or
 * above comfortable capacity, which is a genuine STATUS rather than a second
 * series — and it ships with a legend entry, a marker on the axis, and a text
 * summary underneath, so it never depends on colour alone.
 */

interface DayCurveProps {
  slots: AdjustedDemandSlot[];
  cityName: string;
}

export function DayCurve({ slots, cityName }: DayCurveProps) {
  if (slots.length === 0) {
    return (
      <Card>
        <CardHeader title="Predicted demand today" />
        <p className="text-sm text-muted">No demand data available.</p>
      </Card>
    );
  }

  const overCapacity = slots.filter((slot) => slot.overCapacity);
  const withTrips = slots.filter((slot) => slot.confirmedTrips > 0);

  return (
    <Card>
      <CardHeader
        title="Predicted demand today"
        description={`${cityName}, in 15-minute slots. Index 0–100, where higher is closer to comfortable road capacity.`}
      />

      {/* Legend — present because there are two visual states. */}
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-4 rounded-sm bg-primary" aria-hidden="true" />
          Predicted demand
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-4 rounded-sm bg-traffic-severe" aria-hidden="true" />
          <span aria-hidden="true">■</span> At or above capacity
        </span>
      </div>

      {/* The chart scrolls rather than squashing 76 slots into a phone width. */}
      <div className="overflow-x-auto">
        <div className="min-w-[46rem]">
          <div className="flex h-48 items-end gap-[2px]" aria-hidden="true">
            {slots.map((slot) => (
              <div
                key={slot.minutes}
                title={`${formatSlotLabel(slot.minutes)} — index ${slot.index}`}
                className={cn(
                  "flex-1 rounded-t-sm",
                  slot.overCapacity ? "bg-traffic-severe" : "bg-primary"
                )}
                style={{ height: `${Math.max(2, slot.index)}%` }}
              />
            ))}
          </div>

          {/* Hourly ticks only — a label under all 76 bars is unreadable. */}
          <div className="mt-2 flex gap-[2px]" aria-hidden="true">
            {slots.map((slot) => (
              <div key={slot.minutes} className="flex-1 text-center">
                {slot.minutes % 120 === 0 && (
                  <span className="text-[0.6rem] text-subtle">
                    {formatSlotLabel(slot.minutes).replace(":00", "")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* The same information in words. */}
      <div className="mt-5 space-y-2 border-t border-border-base pt-4 text-sm">
        <p className="text-muted">
          <span className="font-semibold text-fg">{overCapacity.length}</span> of{" "}
          {slots.length} slots are predicted at or above comfortable capacity
          {overCapacity.length > 0 && (
            <>
              {" "}
              — earliest {formatSlotLabel(overCapacity[0].minutes)}, latest{" "}
              {formatSlotLabel(overCapacity[overCapacity.length - 1].minutes)}
            </>
          )}
          .
        </p>

        <p className="text-muted">
          <span className="font-semibold text-fg">
            {withTrips.reduce((sum, slot) => sum + slot.confirmedTrips, 0)}
          </span>{" "}
          confirmed trip
          {withTrips.reduce((sum, slot) => sum + slot.confirmedTrips, 0) === 1 ? "" : "s"} are
          counted on top of the baseline prediction today.
        </p>
      </div>

      <p className="sr-only-cf">
        Predicted demand index by slot:{" "}
        {slots
          .filter((slot) => slot.minutes % 60 === 0)
          .map((slot) => `${formatSlotLabel(slot.minutes)} ${slot.index}`)
          .join(", ")}
        .
      </p>
    </Card>
  );
}
