import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, Card } from "@cityflow/ui";
import {
  EngineRefusedError,
  EngineUnavailableError,
  createEngineClient,
  type Recommendation,
} from "@cityflow/api-client";

import { TravellerNav } from "@/components/traveller-nav";
import { pool } from "@/lib/db";
import { engineUrl } from "@/lib/env";
import { clock, instantFor, zonedToday } from "@/lib/localtime";
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
  if (!session) redirect("/");

  const today = zonedToday();
  const { rows } = await pool().query<Routine>(
    `SELECT id, label, origin_cell, destination_cell, arrive_by,
            arrive_window_minutes, mode
       FROM routines
      WHERE identity_id = $1 AND $2 = ANY(days_of_week)
      ORDER BY arrive_by`,
    [session.identityId, today.weekday],
  );

  const engine = createEngineClient(engineUrl());
  const planned: Planned[] = await Promise.all(
    rows.map(async (routine) => {
      const arriveBy = instantFor(today, routine.arrive_by);
      try {
        return {
          routine,
          arriveBy,
          plan: await engine.recommend({
            city: session.cityId,
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
      <h1 className="text-2xl font-semibold tracking-tight">Today</h1>

      {rows.length === 0 ? (
        <NothingToday />
      ) : (
        <div className="mt-6 max-w-xl space-y-4">
          {planned.map((entry) => (
            <PlanCard key={entry.routine.id} entry={entry} />
          ))}
        </div>
      )}
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

function NothingToday() {
  return (
    <>
      <Card className="mt-6 max-w-xl">
        <h2 className="text-sm font-semibold">No journeys today</h2>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          A routine is a journey you make regularly: where from, where to, which days, and
          the time you need to arrive by. Once one is saved for today, this page shows
          when to leave.
        </p>
        <Link
          href="/routines"
          className="mt-4 inline-block text-sm font-medium text-[var(--accent)]"
        >
          Add a routine
        </Link>
      </Card>

      <Card className="mt-4 max-w-xl">
        <h2 className="text-sm font-semibold">Report road defects as you travel</h2>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          With your phone mounted in a vehicle, CityFlow can spot the jolts that look like
          a pothole and pass them to the council once several travellers have hit the same
          place.
        </p>
        <Link
          href="/report"
          className="mt-4 inline-block text-sm font-medium text-[var(--accent)]"
        >
          Start reporting
        </Link>
      </Card>
    </>
  );
}

function PlanCard({ entry }: { entry: Planned }) {
  const { routine, arriveBy, plan, problem } = entry;

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">{routine.label}</h2>
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
      <p className="mt-4 text-3xl font-semibold tracking-tight">
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
            <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md bg-[var(--line)] text-sm">
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
    <div className="bg-[var(--surface)] p-3">
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
