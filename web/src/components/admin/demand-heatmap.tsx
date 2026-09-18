"use client";

import { useMemo, useState } from "react";

import { Card, CardHeader } from "@/components/ui/card";
import { EmptyNote } from "@/components/admin/panels";
import type { ZoneDemand } from "@/lib/admin/analytics";
import { formatSlotLabel } from "@/lib/demand/time-slots";
import { cn } from "@/lib/utils";

/**
 * Zone × time-slot demand.
 *
 * COLOUR DECISION — the reason this does not use green/amber/red
 * Demand here is ORDERED MAGNITUDE, so it uses a sequential single-hue ramp
 * stepped by lightness. A four-hue status ramp fails colour-vision separation
 * at the red end: "High" and "Very high" sit closer together than most people
 * can resolve, and for a deuteranope they are effectively the same colour. A
 * single hue stepped by lightness survives every form of colour blindness,
 * because lightness is what all of them preserve.
 *
 * On top of that, every cell prints its own number, and the table view below
 * repeats the whole grid as text. Colour is the fastest way to read this grid;
 * it is never the only way.
 */

interface DemandHeatmapProps {
  data: ZoneDemand;
  cityName: string;
}

/** The windows an operator actually wants to look at. */
const WINDOWS = [
  { id: "morning", label: "Morning peak", from: 6 * 60, to: 11 * 60 },
  { id: "midday", label: "Midday", from: 11 * 60, to: 16 * 60 },
  { id: "evening", label: "Evening peak", from: 16 * 60, to: 21 * 60 },
  { id: "all", label: "Full day", from: 0, to: 24 * 60 },
] as const;

type WindowId = (typeof WINDOWS)[number]["id"];

/** Which of the six ramp steps a value falls into. 0 means "no trips". */
function rampStep(value: number, max: number): number {
  if (value <= 0) return 0;
  if (max <= 0) return 1;
  return Math.min(6, Math.max(1, Math.ceil((value / max) * 6)));
}

export function DemandHeatmap({ data, cityName }: DemandHeatmapProps) {
  const [windowId, setWindowId] = useState<WindowId>("morning");
  const [showTable, setShowTable] = useState(false);

  const activeWindow = WINDOWS.find((w) => w.id === windowId)!;

  // Which columns of the full grid fall inside the chosen window.
  const columns = useMemo(
    () =>
      data.slotMinutes
        .map((minutes, index) => ({ minutes, index }))
        .filter(({ minutes }) => minutes >= activeWindow.from && minutes < activeWindow.to),
    [data.slotMinutes, activeWindow.from, activeWindow.to]
  );

  // Rows that have nothing in this window are hidden — an empty row tells you
  // nothing and pushes the interesting ones off the screen.
  const rows = useMemo(
    () =>
      data.rows
        .map((row) => ({
          ...row,
          windowTrips: columns.map(({ index }) => row.trips[index] ?? 0),
        }))
        .filter((row) => row.windowTrips.some((value) => value > 0)),
    [data.rows, columns]
  );

  const windowMax = rows.reduce(
    (max, row) => Math.max(max, ...row.windowTrips),
    0
  );

  return (
    <Card>
      <CardHeader
        title="Demand by zone and time slot"
        description={`${cityName}. Expected trips starting in each area, per 15-minute slot.`}
      />

      {/* Filters, in one row above the chart. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {WINDOWS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setWindowId(option.id)}
            aria-pressed={option.id === windowId}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              option.id === windowId
                ? "border-primary bg-primary-soft text-primary"
                : "border-border-base text-muted hover:bg-surface-2 hover:text-fg"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {data.rows.length === 0 ? (
        <EmptyNote>
          No routines are being counted for this city yet. The grid fills in as people
          complete onboarding — and it only ever holds counts, never individuals.
        </EmptyNote>
      ) : rows.length === 0 ? (
        <EmptyNote>
          No expected trips in the {activeWindow.label.toLowerCase()} window. Try a different
          window.
        </EmptyNote>
      ) : (
        <>
          <div className="overflow-x-auto">
            <div className="min-w-max">
              {/* Column headers, hourly to keep them readable. */}
              <div className="mb-1 flex gap-[2px] pl-40">
                {columns.map(({ minutes }) => (
                  <div key={minutes} className="w-10 text-center">
                    {minutes % 60 === 0 && (
                      <span className="text-[0.6rem] text-subtle">
                        {formatSlotLabel(minutes).replace(":00", "")}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {rows.map((row) => (
                <div key={row.zoneKey} className="mb-[2px] flex items-center gap-[2px]">
                  <div className="w-40 shrink-0 truncate pr-3 text-right text-xs text-fg">
                    {row.zoneLabel}
                  </div>

                  {row.windowTrips.map((value, index) => {
                    const step = rampStep(value, windowMax);
                    return (
                      <div
                        key={columns[index].minutes}
                        title={`${row.zoneLabel} · ${formatSlotLabel(
                          columns[index].minutes
                        )} · ${value} trip${value === 1 ? "" : "s"}`}
                        className="flex h-8 w-10 items-center justify-center rounded-sm text-[0.65rem] font-medium"
                        style={
                          step === 0
                            ? { background: "var(--cf-surface-2)", color: "var(--cf-fg-subtle)" }
                            : {
                                background: `var(--cf-demand-${step})`,
                                color: `var(--cf-demand-${step}-ink)`,
                              }
                        }
                      >
                        {value > 0 ? value : ""}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Ramp legend. */}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted">
            <span>Fewer trips</span>
            <div className="flex gap-[2px]">
              {[1, 2, 3, 4, 5, 6].map((step) => (
                <span
                  key={step}
                  className="h-4 w-6 rounded-sm"
                  style={{ background: `var(--cf-demand-${step})` }}
                  aria-hidden="true"
                />
              ))}
            </div>
            <span>More trips</span>
            <span className="text-subtle">
              (darkest = {windowMax} trip{windowMax === 1 ? "" : "s"} in one slot)
            </span>
          </div>

          {/* Table view, per the accessibility rule that a chart is never the
              only way to read the data. */}
          <div className="mt-5 border-t border-border-base pt-4">
            <button
              type="button"
              onClick={() => setShowTable((open) => !open)}
              aria-expanded={showTable}
              className="text-sm font-medium text-primary underline"
            >
              {showTable ? "Hide the table view" : "Show the table view"}
            </button>

            {showTable && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[30rem] border-collapse text-sm">
                  <caption className="sr-only-cf">
                    Expected trips by zone and time slot, {activeWindow.label}
                  </caption>
                  <thead>
                    <tr className="border-b border-border-base text-left">
                      <th scope="col" className="pb-2 pr-4 text-xs uppercase tracking-wider text-subtle">
                        Zone
                      </th>
                      <th scope="col" className="pb-2 pr-4 text-xs uppercase tracking-wider text-subtle">
                        Busiest slot
                      </th>
                      <th scope="col" className="pb-2 text-xs uppercase tracking-wider text-subtle">
                        Trips in window
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const peakIndex = row.windowTrips.indexOf(
                        Math.max(...row.windowTrips)
                      );
                      const windowTotal = row.windowTrips.reduce((a, b) => a + b, 0);

                      return (
                        <tr key={row.zoneKey} className="border-b border-border-base last:border-0">
                          <td className="py-2.5 pr-4 text-fg">{row.zoneLabel}</td>
                          <td className="py-2.5 pr-4 text-muted">
                            {formatSlotLabel(columns[peakIndex].minutes)} (
                            {row.windowTrips[peakIndex]})
                          </td>
                          <td className="py-2.5 font-medium text-fg">{windowTotal}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Where the numbers come from — stated on the chart, not buried. */}
      <div className="mt-5 rounded-lg bg-surface-2 p-4">
        <p className="text-xs font-semibold text-fg">How to read these numbers</p>
        <ul className="mt-2 space-y-1 text-xs leading-relaxed text-muted">
          <li>
            <span className="font-medium text-fg">{data.confirmedCounted}</span> of{" "}
            <span className="font-medium text-fg">{data.routinesCounted}</span> trips are
            confirmed plans for today. The rest are that person&apos;s usual routine, assumed
            because today is one of their travel days.
          </li>
          <li>
            People who cancelled today, and people who switched off city-level counting, are
            excluded entirely.
          </li>
          <li>
            A zone is the area name a person entered, normalised. These are not official
            transport-authority zones.
          </li>
          <li>
            Every figure here is a count. No user id, CityFlow ID or route reaches this page.
          </li>
        </ul>
      </div>
    </Card>
  );
}
