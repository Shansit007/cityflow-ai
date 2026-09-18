"use client";

import { CityBackdrop } from "@/components/city/city-backdrop";
import { CitySelector } from "@/components/city/city-selector";
import { useCity } from "@/components/city/city-provider";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

/**
 * Landing hero.
 *
 * Leads with the product promise, then immediately shows which city the visitor
 * is looking at — because every number on this site is city-specific.
 */
export function Hero() {
  const { city } = useCity();

  return (
    <section
      className="relative overflow-hidden border-b border-border-base"
      // Gives the illustration a meaningful description for screen readers,
      // since the SVG itself is marked decorative.
      aria-label={`CityFlow AI in ${city.name}`}
    >
      {/* Very light grid texture behind everything. */}
      <div className="cf-grid-lines pointer-events-none absolute inset-0" aria-hidden="true" />

      <CityBackdrop height="lg" />

      <Container width="wide" className="relative">
        <div className="grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          {/* ------------------------------------------------------- copy */}
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border-base bg-surface px-3 py-1.5 text-xs font-medium text-muted">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-secondary" aria-hidden="true" />
              Proactive traffic management · {city.name}
            </p>

            <h1 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-fg sm:text-5xl lg:text-[3.4rem]">
              Smarter Departures,
              <br />
              <span className="text-primary">Smoother Journeys</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              CityFlow AI helps reduce peak traffic by recommending when to travel, before
              congestion builds up.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/signup" size="lg">
                Get Started
              </ButtonLink>
              <ButtonLink href="/how-it-works" variant="outline" size="lg">
                How CityFlow AI Works
              </ButtonLink>
            </div>

            {/* City choice, right where a first-time visitor will look for it. */}
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted">Viewing traffic context for</span>
              <CitySelector variant="compact" />
            </div>

            <p className="mt-4 max-w-lg text-xs leading-relaxed text-subtle">
              Recommendations are suggestions, not instructions. CityFlow AI predicts likely
              demand — it cannot guarantee traffic conditions.
            </p>
          </div>

          {/* --------------------------------------------- the core visual */}
          <div className="lg:pl-4">
            <PeakShiftVisual cityName={city.name} />
          </div>
        </div>
      </Container>
    </section>
  );
}

/**
 * The one picture that explains the whole product:
 * the same number of trips, stacked into one slot vs spread across nearby slots.
 */
function PeakShiftVisual({ cityName }: { cityName: string }) {
  // Both rows carry the SAME total (30 trips). That is the point: CityFlow AI
  // does not remove trips, it changes when they start.
  const before = [
    { time: "8:30", value: 4 },
    { time: "8:45", value: 6 },
    { time: "9:00", value: 14 },
    { time: "9:15", value: 4 },
    { time: "9:30", value: 2 },
  ];

  const after = [
    { time: "8:30", value: 6 },
    { time: "8:45", value: 7 },
    { time: "9:00", value: 7 },
    { time: "9:15", value: 6 },
    { time: "9:30", value: 4 },
  ];

  const maxValue = 14;

  return (
    <div className="rounded-card border border-border-base bg-surface p-5 shadow-raised sm:p-6">
      <p className="text-sm font-semibold text-fg">
        Morning departures in {cityName}
      </p>
      <p className="mt-1 text-xs text-muted">
        Illustrative example — same number of trips in both cases.
      </p>

      <div className="mt-6 space-y-6">
        <MiniChart
          label="Everyone leaves at the same time"
          caption="High peak"
          captionTone="high"
          data={before}
          maxValue={maxValue}
          barClassName="bg-traffic-high"
          peakIndex={2}
        />

        <div className="flex items-center gap-3" aria-hidden="true">
          <div className="h-px flex-1 bg-border-base" />
          <span className="text-xs font-medium uppercase tracking-wider text-subtle">
            With CityFlow AI
          </span>
          <div className="h-px flex-1 bg-border-base" />
        </div>

        <MiniChart
          label="Trips spread across nearby time slots"
          caption="Smoother traffic"
          captionTone="low"
          data={after}
          maxValue={maxValue}
          barClassName="bg-traffic-low"
        />
      </div>
    </div>
  );
}

function MiniChart({
  label,
  caption,
  captionTone,
  data,
  maxValue,
  barClassName,
  peakIndex,
}: {
  label: string;
  caption: string;
  captionTone: "high" | "low";
  data: Array<{ time: string; value: number }>;
  maxValue: number;
  barClassName: string;
  peakIndex?: number;
}) {
  return (
    <figure>
      <figcaption className="mb-3 flex items-baseline justify-between gap-3">
        <span className="text-sm text-fg">{label}</span>
        <span
          className={
            captionTone === "high"
              ? "text-xs font-semibold text-traffic-high"
              : "text-xs font-semibold text-traffic-low"
          }
        >
          {caption}
        </span>
      </figcaption>

      {/*
        The bars are DIRECT children of a fixed-height flex row. That matters:
        a percentage height only works when the parent has a definite height.
        The time labels sit in a separate row below, sharing the same widths.
      */}
      <div className="flex h-24 items-end gap-2" aria-hidden="true">
        {data.map((slot, index) => (
          <div
            key={slot.time}
            className={`flex-1 rounded-t-md ${barClassName} ${
              index === peakIndex ? "opacity-100" : "opacity-70"
            }`}
            style={{ height: `${(slot.value / maxValue) * 100}%` }}
          />
        ))}
      </div>

      <div className="mt-2 flex gap-2" aria-hidden="true">
        {data.map((slot) => (
          <span key={slot.time} className="flex-1 text-center text-[0.65rem] text-subtle">
            {slot.time}
          </span>
        ))}
      </div>

      {/* Text version of the same data, for screen readers and for anyone who
          cannot distinguish the bar colours. */}
      <p className="sr-only-cf">
        {label}. {data.map((slot) => `${slot.time}: ${slot.value} trips`).join(", ")}.
      </p>
    </figure>
  );
}
