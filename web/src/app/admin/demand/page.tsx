import type { Metadata } from "next";

import { CitySwitcher } from "@/components/admin/city-switcher";
import { DayCurve } from "@/components/admin/day-curve";
import { DemandHeatmap } from "@/components/admin/demand-heatmap";
import { StatTile } from "@/components/admin/panels";
import { Card, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { loadCityOverview, loadZoneDemand } from "@/lib/admin/analytics";
import { formatAppDate } from "@/lib/app-time";
import { getCity } from "@/lib/cities";
import { CAPACITY_THRESHOLD, TRIP_WEIGHT } from "@/lib/demand/aggregate";
import { formatSlotLabel } from "@/lib/demand/time-slots";

export const metadata: Metadata = { title: "Demand" };

/**
 * Admin Portal — demand detail.
 *
 * The overview answers "how busy". This page answers "where, and when" — the
 * zone × slot grid an operator would use to decide whether a corridor needs
 * attention.
 */
export default async function AdminDemandPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const params = await searchParams;
  const city = getCity(params.city);

  const [overview, zoneDemand] = await Promise.all([
    loadCityOverview(city.code),
    loadZoneDemand(city.code),
  ]);

  const busiestZone = zoneDemand.rows[0] ?? null;

  return (
    <section className="py-8">
      <Container width="wide">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              Demand
            </h1>
            <p className="mt-2 text-sm text-muted">
              {overview.cityName} · {formatAppDate()}
            </p>
          </div>

          <CitySwitcher active={city.code} basePath="/admin/demand" />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Zones with demand"
            value={String(zoneDemand.rows.length)}
            detail="Distinct origin areas expected to generate trips today"
          />
          <StatTile
            label="Trips counted"
            value={String(zoneDemand.routinesCounted)}
            detail={`${zoneDemand.confirmedCounted} confirmed, the rest assumed from routines`}
          />
          <StatTile
            label="Busiest zone"
            value={busiestZone ? busiestZone.zoneLabel : "—"}
            detail={busiestZone ? `${busiestZone.total} trips today` : "No demand recorded yet"}
          />
          <StatTile
            label="Slots over capacity"
            value={String(overview.overCapacityCount)}
            detail={`Index ${CAPACITY_THRESHOLD}+ counts as over capacity`}
            tone={overview.overCapacityCount > 0 ? "alert" : "default"}
          />
        </div>

        <div className="mt-6">
          <DemandHeatmap data={zoneDemand} cityName={overview.cityName} />
        </div>

        <div className="mt-6">
          <DayCurve slots={overview.dayCurve} cityName={overview.cityName} />
        </div>

        {/* ------------------------------------------ how demand is computed */}
        <Card className="mt-6">
          <CardHeader
            title="How the demand index is built"
            description="Stated plainly, because every figure in this portal depends on it."
          />

          <div className="overflow-x-auto">
            <pre className="min-w-max rounded-lg bg-surface-2 p-4 text-xs leading-relaxed text-fg">
{`adjusted(slot) =  baseline(slot)
               +  confirmed trips in slot × ${TRIP_WEIGHT}
               +  impact of any active network event

over capacity  =  adjusted(slot) >= ${CAPACITY_THRESHOLD}`}
            </pre>
          </div>

          <dl className="mt-5 space-y-4 text-sm">
            <div>
              <dt className="font-medium text-fg">baseline</dt>
              <dd className="mt-1 leading-relaxed text-muted">
                A <span className="font-medium text-fg">modelled</span> curve, not measured
                traffic. It reproduces the shape urban demand reliably takes — an overnight
                floor, a sharp morning peak, a midday bump, a broader evening peak, a flatter
                weekend — scaled by city and varied day to day. CityFlow AI has no live
                traffic feed; inventing one would make every number here dishonest.
              </dd>
            </div>

            <div>
              <dt className="font-medium text-fg">confirmed trips × {TRIP_WEIGHT}</dt>
              <dd className="mt-1 leading-relaxed text-muted">
                Each confirmed plan is weighted as more than one vehicle, on the same
                assumption any sampled travel survey makes: a participant represents a slice
                of the travelling public. With a handful of registered users a literal count
                could never move a city-scale index. This is a{" "}
                <span className="font-medium text-fg">modelling choice</span> and it is the
                single number to change when real trip volumes are available.
              </dd>
            </div>

            <div>
              <dt className="font-medium text-fg">network events</dt>
              <dd className="mt-1 leading-relaxed text-muted">
                Accidents, closures, weather and public events raise the effective demand in
                the slots they cover. The table and the full recalculation path exist and
                work — but{" "}
                <span className="font-medium text-fg">no live feed is connected</span>, so
                rows are entered by hand.
              </dd>
            </div>
          </dl>
        </Card>

        {/* --------------------------------------------------- peak listing */}
        <Card className="mt-6">
          <CardHeader
            title="Slots at or above capacity"
            description="Where the optimiser will try to spread trips away from."
          />

          {overview.dayCurve.filter((slot) => slot.overCapacity).length === 0 ? (
            <p className="rounded-lg border border-dashed border-border-strong bg-surface-2 p-5 text-center text-sm text-muted">
              No slot is predicted at or above comfortable capacity today.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[26rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-base text-left">
                    <th scope="col" className="pb-2 pr-4 text-xs uppercase tracking-wider text-subtle">
                      Slot
                    </th>
                    <th scope="col" className="pb-2 pr-4 text-xs uppercase tracking-wider text-subtle">
                      Index
                    </th>
                    <th scope="col" className="pb-2 pr-4 text-xs uppercase tracking-wider text-subtle">
                      Baseline
                    </th>
                    <th scope="col" className="pb-2 text-xs uppercase tracking-wider text-subtle">
                      Confirmed trips
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {overview.dayCurve
                    .filter((slot) => slot.overCapacity)
                    .map((slot) => (
                      <tr key={slot.minutes} className="border-b border-border-base last:border-0">
                        <td className="py-2.5 pr-4 font-medium text-fg">
                          {formatSlotLabel(slot.minutes)}
                        </td>
                        <td className="py-2.5 pr-4 font-semibold text-traffic-severe">
                          {slot.index}
                        </td>
                        <td className="py-2.5 pr-4 text-muted">{slot.baselineIndex}</td>
                        <td className="py-2.5 text-muted">{slot.confirmedTrips}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </Container>
    </section>
  );
}
