import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, Card } from "@cityflow/ui";

import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const session = await readSession();
  if (!session) redirect("/");

  return (
    <AppShell productName="CityFlow AI" nav={<span>{session.cityId}</span>}>
      <h1 className="text-2xl font-semibold tracking-tight">Today</h1>

      <Card className="mt-6 max-w-xl">
        <h2 className="text-sm font-semibold">No journeys saved yet</h2>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          A routine is a journey you make regularly: where from, where to, which days, and
          the time you need to arrive by. Once one is saved, this page shows when to leave
          and what leaving at your usual time would have cost you.
        </p>
        <Link
          href="/routines"
          className="mt-4 inline-block text-sm font-medium text-[var(--accent)]"
        >
          Add your first routine
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
    </AppShell>
  );
}
