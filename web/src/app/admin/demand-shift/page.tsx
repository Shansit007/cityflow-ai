import type { Metadata } from "next";

import { CitySwitcher } from "@/components/admin/city-switcher";
import { DistributionChart } from "@/components/admin/distribution-chart";
import { BreakdownBarPanel, StatTile } from "@/components/admin/panels";
import { Card, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { loadDemandShiftIntelligence } from "@/lib/admin/demand-shift";
import { formatAppDate } from "@/lib/app-time";
import { getCity } from "@/lib/cities";

export const metadata: Metadata = { title: "Demand shift" };

/**
 * Admin Portal — Demand Shift Intelligence.
 *
 * The Demand page (/admin/demand) answers "where is demand today". This page
 * answers a different question: "over the last month, how has demand actually
 * moved" — which slots are gaining people, which are losing them, which zones
 * are shifting the most, and whether the trend is building or fading. All of
 * it is built from real decided recommendations (ACCEPTED, CUSTOM or
 * KEPT_USUAL) — see lib/admin/demand-shift.ts for exactly how "original" and
 * "current" are derived, and why PENDING recommendations are excluded.
 */
export default async function AdminDemandShiftPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const params = await searchParams;
  const city = getCity(params.city);

  const shift = await loadDemandShiftIntelligence(city.code);

  const gainerRows = shift.gainers.map((row) => ({
    label: `${row.label} (+${row.delta})`,
    value: row.currentCount,
  }));
  const loserRows = shift.losers.map((row) => ({
    label: `${row.label} (${row.delta})`,
    value: row.originalCount,
  }));
  const zoneRows = shift.byZone.map((row) => ({ label: row.zoneLabel, value: row.movedCount }));

  const trendMax = Math.max(1, ...shift.trend.map((point) => point.confirmedTrips));
  const firstTrendPoint = shift.trend[0] ?? null;
  const lastTrendPoint = shift.trend[shift.trend.length - 1] ?? null;

  return (
    <section className="py-8">
      <Container width="wide">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              Demand shift
            </h1>
            <p className="mt-2 text-sm text-muted">
              {city.name} · {formatAppDate()}
            </p>
          </div>

          <CitySwitcher active={city.code} basePath="/admin/demand-shift" />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Decisions in window"
            value={String(shift.sampleSize)}
            detail={`Accepted, kept-usual or custom time, last ${shift.windowDays} days`}
          />
          <StatTile
            label="Slots gaining demand"
            value={String(shift.gainers.length)}
            detail="15-minute slots with more people arriving than leaving"
          />
          <StatTile
            label="Slots losing demand"
            value={String(shift.losers.length)}
            detail="15-minute slots with more people leaving than arriving"
          />
          <StatTile
            label="Zones shifting"
            value={String(shift.byZone.length)}
            detail="Origin areas with at least one changed departure time"
          />
        </div>

        <div className="mt-6">
          <DistributionChart
            distribution={shift.distribution}
            sampleSize={shift.sampleSize}
            windowDays={shift.windowDays}
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <BreakdownBarPanel
            title="Slots gaining demand"
            description="Where people are moving their departure to — the count shown is trips now settled in that slot."
            rows={gainerRows}
            emptyMessage="No slot has gained net demand in this window yet."
          />
          <BreakdownBarPanel
            title="Slots losing demand"
            description="Where people are moving their departure away from — the count shown is trips originally in that slot."
            rows={loserRows}
            emptyMessage="No slot has lost net demand in this window yet."
          />
        </div>

        <div className="mt-6">
          <BreakdownBarPanel
            title="Demand shift by zone"
            description="Origin areas with the most departure-time changes, by trips linked to a journey there."
            rows={zoneRows}
            emptyMessage="No journey-linked departure time has changed in this window yet."
          />
        </div>

        {/* ------------------------------------------------------------ trend */}
        <Card className="mt-6">
          <CardHeader
            title="Demand trend over time"
            description={`Confirmed plans per day, last ${shift.windowDays} days.`}
          />

          {shift.trend.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border-strong bg-surface-2 p-5 text-center text-sm text-muted">
              No confirmed plans have been recorded in this window yet.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <div className="flex h-32 min-w-[36rem] items-end gap-1" aria-hidden="true">
                  {shift.trend.map((point) => (
                    <div key={point.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                      <div
                        title={`${point.date}: ${point.confirmedTrips} confirmed plans`}
                        className="w-full rounded-t-sm bg-primary"
                        style={{
                          height: `${Math.max(2, (point.confirmedTrips / trendMax) * 100)}%`,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {firstTrendPoint && lastTrendPoint && firstTrendPoint.date !== lastTrendPoint.date && (
                <p className="mt-4 text-sm text-muted">
                  From <span className="font-medium text-fg">{firstTrendPoint.date}</span> (
                  {firstTrendPoint.confirmedTrips} confirmed) to{" "}
                  <span className="font-medium text-fg">{lastTrendPoint.date}</span> (
                  {lastTrendPoint.confirmedTrips} confirmed).
                </p>
              )}

              <p className="sr-only-cf">
                Confirmed plans by day:{" "}
                {shift.trend.map((point) => `${point.date}: ${point.confirmedTrips}`).join(", ")}.
              </p>
            </>
          )}
        </Card>

        <p className="mt-6 text-xs leading-relaxed text-subtle">
          &ldquo;Original&rdquo; is always the usual departure time from a person&apos;s travel
          routine. &ldquo;Current&rdquo; is the time they actually settled on — the recommended
          time if accepted, their own chosen time if custom, or their usual time if kept
          unchanged. Recommendations with no decision yet are not included, because there is
          nothing to compare yet.
        </p>
      </Container>
    </section>
  );
}
