import type { Metadata } from "next";
import type { SimulationRun } from "@prisma/client";

import { CitySwitcher } from "@/components/admin/city-switcher";
import { EmptyNote } from "@/components/admin/panels";
import { SimulationForm } from "@/components/admin/simulation-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { loadSimulationRuns } from "@/lib/admin/analytics";
import { APP_TIMEZONE } from "@/lib/app-time";
import { getCity } from "@/lib/cities";
import { formatDuration } from "@/lib/demand/time-slots";

export const metadata: Metadata = { title: "Simulation" };

/**
 * Admin Portal — SUMO evaluation.
 *
 * THE HONEST SHAPE OF THIS FEATURE
 * The project's central claim is that spreading departures reduces the peak.
 * The only way to test that without deploying to a real city is simulation, and
 * the only credible way to present it is a controlled comparison:
 *
 *     same travellers, same origins, same destinations, same trip count
 *     the ONLY difference is departure time
 *
 * CityFlow AI produces both demand files and stores both sets of results. It
 * does not run SUMO — SUMO is a desktop simulator, and a web app claiming to
 * have run one would be fabricating the project's key evidence.
 */
export default async function AdminSimulationPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const params = await searchParams;
  const city = getCity(params.city);

  const runs = await loadSimulationRuns(city.code);

  const latestBaseline = runs.find((run) => run.scenario === "BASELINE") ?? null;
  const latestCityflow = runs.find((run) => run.scenario === "CITYFLOW") ?? null;

  return (
    <section className="py-8">
      <Container width="wide">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              Simulation evaluation
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
              Does spreading departures actually reduce the peak? The only way to find out
              without deploying to a real city is to simulate both days on the same road
              network and compare them.
            </p>
          </div>

          <CitySwitcher active={city.code} basePath="/admin/simulation" />
        </div>

        {/* ------------------------------------------------------ comparison */}
        <Card className="mt-8" raised>
          <CardHeader
            title="Baseline vs CityFlow AI"
            description="The most recent run of each scenario for this city."
          />

          {!latestBaseline || !latestCityflow ? (
            <EmptyNote>
              A comparison needs one run of each scenario. So far there
              {runs.length === 0
                ? " are no recorded runs for this city."
                : ` is ${runs.length === 1 ? "1 recorded run" : `${runs.length} recorded runs`}, but not one of each scenario yet.`}{" "}
              Export both demand files below, run them in SUMO, then record the results.
            </EmptyNote>
          ) : (
            <>
              {latestBaseline.networkSource !== latestCityflow.networkSource && (
                <div className="mb-4 rounded-lg bg-traffic-moderate-soft px-4 py-3 text-sm leading-relaxed text-traffic-moderate">
                  <span className="font-semibold">These two runs used different networks.</span>{" "}
                  &ldquo;{latestBaseline.networkSource}&rdquo; versus &ldquo;
                  {latestCityflow.networkSource}&rdquo;. Any difference below may be caused by
                  the network rather than by demand smoothing — re-run both on the same one
                  before drawing a conclusion.
                </div>
              )}

              <ComparisonTable baseline={latestBaseline} cityflow={latestCityflow} />

              <p className="mt-5 text-xs leading-relaxed text-subtle">
                A negative change means CityFlow AI&apos;s day was better on that measure.
                These are the results of two simulations of one day, not a measured outcome on
                a real road network, and a single pair of runs is not evidence of a general
                effect — repeat across several days and demand levels before claiming one.
              </p>
            </>
          )}
        </Card>

        {/* --------------------------------------------------------- exports */}
        <Card className="mt-6">
          <CardHeader
            title="1. Export today's demand"
            description="Two files with the same travellers and the same trips. Only the departure times differ."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <ExportBlock
              title="Baseline"
              description="Everyone departs at their normal time. The day without CityFlow AI."
              city={city.code}
              scenario="BASELINE"
            />
            <ExportBlock
              title="CityFlow AI"
              description="Departures follow the recommendations, or a confirmed plan where one exists."
              city={city.code}
              scenario="CITYFLOW"
            />
          </div>

          <div className="mt-5 rounded-lg bg-surface-2 p-4">
            <p className="text-sm font-medium text-fg">You also need the zone file</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              Trips refer to zones by name, so SUMO needs to know which network edges each zone
              covers. The template below lists every zone with an empty{" "}
              <code className="rounded bg-surface px-1 py-0.5 text-xs">edges</code> attribute
              for you to fill in from your network — CityFlow AI cannot generate those ids,
              because they only exist once you have built the network, and a guess would
              produce a simulation that runs but means nothing.
            </p>

            <a
              href={`/api/admin/simulation/export?scenario=BASELINE&format=taz&city=${city.code}`}
              download
              className="mt-3 inline-flex h-9 items-center rounded-lg border border-border-strong bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-3"
            >
              Download zone template (.add.xml)
            </a>
          </div>
        </Card>

        {/* -------------------------------------------------------- pipeline */}
        <Card className="mt-6">
          <CardHeader
            title="2. Run both in SUMO"
            description="On your own machine. SUMO and OpenStreetMap are both free and open source."
          />

          <div className="overflow-x-auto">
            <pre className="min-w-max rounded-lg bg-surface-2 p-4 text-xs leading-relaxed text-fg">
{`# a. Build the road network from an OpenStreetMap extract
netconvert --osm-files ${city.code}.osm.xml -o ${city.code}.net.xml \\
           --geometry.remove --roundabouts.guess --ramps.guess \\
           --junctions.join --tls.guess-signals --tls.discard-simple

# b. Fill in the edges="" attributes in the zone template, then route both files
duarouter -n ${city.code}.net.xml --taz-files tazs.add.xml \\
          -t baseline.trips.xml -o baseline.rou.xml
duarouter -n ${city.code}.net.xml --taz-files tazs.add.xml \\
          -t cityflow.trips.xml -o cityflow.rou.xml

# c. Run both, with identical settings
sumo -n ${city.code}.net.xml -r baseline.rou.xml \\
     --tripinfo-output baseline.tripinfo.xml --summary baseline.summary.xml
sumo -n ${city.code}.net.xml -r cityflow.rou.xml \\
     --tripinfo-output cityflow.tripinfo.xml --summary cityflow.summary.xml`}
            </pre>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-muted">
            Full instructions, including where each metric comes from in the output files, are
            in <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">docs/04-SUMO-EVALUATION.md</code>.
          </p>
        </Card>

        {/* ---------------------------------------------------------- record */}
        <div className="mt-6">
          <SimulationForm cityCode={city.code} />
        </div>

        {/* ------------------------------------------------------ run history */}
        <Card className="mt-6">
          <CardHeader title="Recorded runs" description="Newest first." />

          {runs.length === 0 ? (
            <EmptyNote>No simulation runs have been recorded for this city yet.</EmptyNote>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-base text-left">
                    {["Recorded", "Scenario", "Vehicles", "Mean travel", "Total delay", "Peak slot", "Network"].map(
                      (heading) => (
                        <th
                          key={heading}
                          scope="col"
                          className="pb-2 pr-4 text-xs uppercase tracking-wider text-subtle"
                        >
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className="border-b border-border-base last:border-0">
                      <td className="py-2.5 pr-4 text-muted">{formatWhen(run.createdAt)}</td>
                      <td className="py-2.5 pr-4">
                        <Badge tone={run.scenario === "CITYFLOW" ? "secondary" : "neutral"}>
                          {run.scenario === "CITYFLOW" ? "CityFlow AI" : "Baseline"}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-4 text-fg">{run.vehiclesDeparted}</td>
                      <td className="py-2.5 pr-4 text-fg">
                        {formatSeconds(run.meanTravelTimeSeconds)}
                      </td>
                      <td className="py-2.5 pr-4 text-fg">
                        {formatSeconds(run.totalDelaySeconds)}
                      </td>
                      <td className="py-2.5 pr-4 text-fg">{run.peakSlotVehicles}</td>
                      <td className="py-2.5 max-w-[16rem] truncate text-muted" title={run.networkSource}>
                        {run.networkSource}
                      </td>
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

/* -------------------------------------------------------------------------- */

function ExportBlock({
  title,
  description,
  city,
  scenario,
}: {
  title: string;
  description: string;
  city: string;
  scenario: "BASELINE" | "CITYFLOW";
}) {
  return (
    <div className="rounded-lg border border-border-base p-4">
      <p className="text-sm font-semibold text-fg">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`/api/admin/simulation/export?scenario=${scenario}&format=trips&city=${city}`}
          download
          className="inline-flex h-9 items-center rounded-lg border border-border-strong bg-surface px-3 text-xs font-medium text-fg hover:bg-surface-2"
        >
          .trips.xml
        </a>
        <a
          href={`/api/admin/simulation/export?scenario=${scenario}&format=od&city=${city}`}
          download
          className="inline-flex h-9 items-center rounded-lg border border-border-base bg-surface px-3 text-xs font-medium text-muted hover:bg-surface-2 hover:text-fg"
        >
          .od.csv
        </a>
      </div>
    </div>
  );
}

/** The metric comparison. Lower is better for every row here. */
function ComparisonTable({
  baseline,
  cityflow,
}: {
  baseline: SimulationRun;
  cityflow: SimulationRun;
}) {
  const rows = [
    {
      label: "Mean travel time",
      base: baseline.meanTravelTimeSeconds,
      flow: cityflow.meanTravelTimeSeconds,
      format: formatSeconds,
    },
    {
      label: "Total delay",
      base: baseline.totalDelaySeconds,
      flow: cityflow.totalDelaySeconds,
      format: formatSeconds,
    },
    {
      label: "Mean waiting time",
      base: baseline.meanWaitingSeconds,
      flow: cityflow.meanWaitingSeconds,
      format: formatSeconds,
    },
    {
      label: "Busiest 15-minute slot",
      base: baseline.peakSlotVehicles,
      flow: cityflow.peakSlotVehicles,
      format: (value: number) => `${value} vehicles`,
    },
    {
      label: "Vehicles departed",
      base: baseline.vehiclesDeparted,
      flow: cityflow.vehiclesDeparted,
      format: (value: number) => String(value),
    },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border-base text-left">
            <th scope="col" className="pb-2 pr-4 text-xs uppercase tracking-wider text-subtle">
              Measure
            </th>
            <th scope="col" className="pb-2 pr-4 text-xs uppercase tracking-wider text-subtle">
              Baseline
            </th>
            <th scope="col" className="pb-2 pr-4 text-xs uppercase tracking-wider text-subtle">
              CityFlow AI
            </th>
            <th scope="col" className="pb-2 text-xs uppercase tracking-wider text-subtle">
              Change
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const delta = row.flow - row.base;
            const percent = row.base > 0 ? (delta / row.base) * 100 : null;

            // Vehicle count should be identical between scenarios — the same
            // people are travelling. A difference means the two exports were
            // taken at different times, which is worth flagging.
            const isVehicleCount = row.label === "Vehicles departed";

            return (
              <tr key={row.label} className="border-b border-border-base last:border-0">
                <td className="py-3 pr-4 text-fg">{row.label}</td>
                <td className="py-3 pr-4 text-muted">{row.format(row.base)}</td>
                <td className="py-3 pr-4 font-medium text-fg">{row.format(row.flow)}</td>
                <td className="py-3">
                  {delta === 0 ? (
                    <span className="text-muted">no change</span>
                  ) : (
                    <span
                      className={
                        isVehicleCount
                          ? "font-medium text-traffic-moderate"
                          : delta < 0
                            ? "font-semibold text-traffic-low"
                            : "font-semibold text-traffic-high"
                      }
                    >
                      {delta < 0 ? "−" : "+"}
                      {row.format(Math.abs(delta))}
                      {percent !== null && (
                        <span className="ml-1 text-xs font-normal">
                          ({percent > 0 ? "+" : ""}
                          {percent.toFixed(1)}%)
                        </span>
                      )}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  return formatDuration(Math.round(seconds / 60));
}

function formatWhen(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: APP_TIMEZONE,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}
