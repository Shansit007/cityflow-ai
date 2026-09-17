import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AppShell,
  Card,
  EmptyState,
  PageHeader,
  Section,
  Stat,
  StatRow,
} from "@cityflow/ui";
import {
  EngineRefusedError,
  EngineUnavailableError,
  createEngineClient,
  type Recommendation,
} from "@cityflow/api-client";

import { PressureChart } from "@/components/pressure-chart";
import { TravellerNav } from "@/components/traveller-nav";
import { pool } from "@/lib/db";
import { engineUrl } from "@/lib/env";
import { travellerImpact } from "@/lib/impact";
import { clock, instantFor, zonedToday } from "@/lib/localtime";
import { cityPressure } from "@/lib/pressure";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

interface Routine {
  id: string;
  label: string;
  origin_cell: string;
  destination_cell: string;
  arrive_by: string;
  arrive_window_minutes: number;
  mode: string;
}

interface Planned {
  routine: Routine;
  arriveBy: Date;
  plan: Recommendation | null;
  problem: string | null;
}

export default async function TodayPage() {
  const session = await readSession();
  if (!session) redirect("/signin");

  const today = zonedToday();
  const city = session.cityId.slice(0, 3);

  const [{ rows }, pressure, impact] = await Promise.all([
    pool().query<Routine>(
      `SELECT id, label, origin_cell, destination_cell, arrive_by,
              arrive_window_minutes, mode
         FROM routines
        WHERE identity_id = $1 AND $2 = ANY(days_of_week)
        ORDER BY arrive_by`,
      [session.identityId, today.weekday],
    ),
    cityPressure(city),
    travellerImpact(session.identityId),
  ]);

  const engine = createEngineClient(engineUrl());
  const planned: Planned[] = await Promise.all(
    rows.map(async (routine) => {
      const arriveBy = instantFor(today, routine.arrive_by);
      try {
        return {
          routine,
          arriveBy,
          plan: await engine.recommend({
            city,
            identity_id: session.identityId,
            routine_id: routine.id,
            origin_cell: routine.origin_cell,
            destination_cell: routine.destination_cell,
            arrive_by: arriveBy.toISOString(),
            arrive_window_minutes: routine.arrive_window_minutes,
            mode: routine.mode,
          }),
          problem: null,
        };
      } catch (error) {
        // One routine failing to plan is not a reason to show the traveller nothing
        // for the others. The reason is shown on the card it belongs to.
        return { routine, arriveBy, plan: null, problem: reasonFor(error) };
      }
    }),
  );

  return (
    <AppShell productName="CityFlow AI" nav={<TravellerNav current="today" />}>
      <PageHeader
        title="Today"
        description={`${new Date().toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })} — when to leave, and what the roads look like while you do.`}
      />

      <div className="mt-6">
        <StatRow>
          <Stat
            label="Roads over capacity now"
            value={pressure.now ? pressure.now.over.toLocaleString() : "—"}
            hint={
              pressure.now
                ? `of ${pressure.now.measured.toLocaleString()} measured at ${pressure.now.at}`
                : "nothing measured for this quarter hour"
            }
            tone={pressure.now && pressure.now.over > 0 ? "warn" : "neutral"}
          />
          <Stat
            label="Busiest segment today"
            value={pressure.busiest ? `${pressure.busiest.ratio.toFixed(1)}×` : "—"}
            hint={pressure.busiest ? "its capacity, at peak" : "no load recorded"}
            tone={pressure.busiest && pressure.busiest.ratio > 1 ? "warn" : "neutral"}
          />
          <Stat
            label="Segments monitored"
            value={pressure.segmentsLoaded.toLocaleString()}
            hint="in your city's road network"
          />
          <Stat
            label="Minutes you have moved"
            value={impact.minutesShifted.toLocaleString()}
            hint={`across ${impact.journeysPlanned.toLocaleString()} journeys planned`}
            tone="accent"
          />
        </StatRow>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section title="Your journeys" aside={`${rows.length} today`}>
            {rows.length === 0 ? (
              <EmptyState
                title="No journeys today"
                action={
                  <Link
                    href="/routines"
                    className="text-sm font-medium text-[var(--accent)]"
                  >
                    Add a routine
                  </Link>
                }
              >
                A routine is a journey you make regularly: where from, where to, which
                days, and the time you need to arrive by. Save one for today and this is
                where the departure time appears.
              </EmptyState>
            ) : (
              <div className="space-y-4">
                {planned.map((entry) => (
                  <PlanCard key={entry.routine.id} entry={entry} />
                ))}
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-8">
          <Section
            title="City pressure"
            aside={pressure.now ? `now ${pressure.now.at}` : "today"}
          >
            {pressure.windows.length === 0 ? (
              <p className="text-sm text-[var(--ink-muted)]">
                No load is recorded for today. The engine plans against an empty road and
                will tell everyone their usual time is fine, which is correct and not very
                useful.
              </p>
            ) : (
              <PressureChart windows={pressure.windows} now={pressure.now} />
            )}
          </Section>

          <Section title="Your impact">
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat
                label="Roads spared"
                value={impact.roadsSpared.toLocaleString()}
                hint="arrivals moved off a full road"
                tone="accent"
              />
              <Stat
                label="Defects confirmed"
                value={impact.defectsConfirmed.toLocaleString()}
                hint="others hit the same place"
              />
            </div>
            <p className="mt-3 text-xs text-[var(--ink-muted)]">
              Counted from the recommendations you were actually given, not from a tally
              kept alongside them.
            </p>
          </Section>
        </div>
      </div>
    </AppShell>
  );
}

function reasonFor(error: unknown): string {
  if (error instanceof EngineRefusedError) {
    return `The planning engine could not plan this journey: ${error.detail}`;
  }
  if (error instanceof EngineUnavailableError) {
    return "The planning engine is not responding, so there is no departure time for this journey yet.";
  }
  return "This journey could not be planned.";
}

function PlanCard({ entry }: { entry: Planned }) {
  const { routine, arriveBy, plan, problem } = entry;

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{routine.label}</h3>
        <span className="text-sm text-[var(--ink-muted)]">
          arrive by {clock(arriveBy)}
        </span>
      </div>

      {problem !== null || plan === null ? (
        <p className="mt-3 text-sm text-[var(--ink-muted)]">{problem}</p>
      ) : (
        <PlanBody plan={plan} />
      )}

      <StartJourney />
    </Card>
  );
}

function StartJourney() {
  return (
    <div className="mt-6 border-t border-[var(--line)] pt-4">
      <Link
        href="/report"
        className="inline-block rounded-[var(--radius)] bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-ink)]"
      >
        Start journey
      </Link>
      <p className="mt-2 text-xs text-[var(--ink-muted)]">
        Mount your phone and CityFlow watches how the road shakes it, passing the jolts
        that look like holes to the council once other travellers hit the same place.
        Nothing is recorded until you press start.
      </p>
    </div>
  );
}

function PlanBody({ plan }: { plan: Recommendation }) {
  const depart = new Date(plan.depart_at);
  const usual = new Date(plan.usual_depart_at);
  const naive = new Date(plan.naive_depart_at);
  const avoided = plan.roads_over_at_usual - plan.roads_over_at_plan;

  return (
    <>
      <p className="mt-4 text-4xl font-semibold tracking-tight">
        Leave at {clock(depart)}
      </p>

      {plan.shift_minutes === 0 ? (
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          That is your usual time. Every road on this route is inside its capacity when
          you travel, so there is nothing to move around.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            {plan.shift_minutes} minutes earlier than usual, arriving at the same time.
            Leaving at {clock(usual)} would put you on roads already at their limit.
          </p>
          {avoided > 0 ? (
            <dl className="mt-4 grid max-w-md grid-cols-2 gap-px overflow-hidden rounded-[var(--radius)] bg-[var(--line)] text-sm">
              <Figure label={`At ${clock(usual)}`} value={plan.roads_over_at_usual} />
              <Figure label={`At ${clock(depart)}`} value={plan.roads_over_at_plan} />
            </dl>
          ) : null}
        </>
      )}

      {naive.getTime() !== depart.getTime() ? (
        <p className="mt-4 border-t border-[var(--line)] pt-3 text-xs text-[var(--ink-muted)]">
          A system planning for you alone would have said {clock(naive)}. That slot is
          being taken by other travellers this morning, which is the part an app can only
          know if it keeps track of what it has already advised.
        </p>
      ) : null}
    </>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[var(--surface-raised)] p-3">
      <dt className="text-xs text-[var(--ink-muted)]">
        {label}
        <span className="sr-only"> roads on your route</span>
      </dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">
        {value === 0 ? "all clear" : `${value} over capacity`}
      </dd>
    </div>
  );
}
