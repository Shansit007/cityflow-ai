import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@cityflow/ui";

import { RoutineForm } from "@/components/routine-form";
import { RoutineList, type SavedRoutine } from "@/components/routine-list";
import { pool } from "@/lib/db";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function RoutinesPage() {
  const session = await readSession();
  if (!session) redirect("/");

  const result = await pool().query<SavedRoutine>(
    `SELECT id, label, origin_cell, destination_cell, days_of_week, arrive_by, mode
       FROM routines
      WHERE identity_id = $1
      ORDER BY arrive_by`,
    [session.identityId],
  );

  return (
    <AppShell
      productName="CityFlow AI"
      nav={
        <Link href="/today" className="text-[var(--ink-muted)] hover:text-[var(--ink)]">
          Today
        </Link>
      }
    >
      <h1 className="text-2xl font-semibold tracking-tight">Your routines</h1>
      <p className="mt-3 max-w-xl text-sm text-[var(--ink-muted)]">
        A routine is a journey you make regularly. CityFlow needs the time you have to
        arrive by, not the time you usually leave, because the departure time is the part
        it works out.
      </p>

      {result.rows.length > 0 ? (
        <div className="mt-8 max-w-xl">
          <RoutineList routines={result.rows} />
        </div>
      ) : null}

      <div className="mt-8">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-[var(--ink-muted)]">
          {result.rows.length > 0 ? "Add another" : "Add your first"}
        </h2>
        <RoutineForm />
      </div>
    </AppShell>
  );
}
