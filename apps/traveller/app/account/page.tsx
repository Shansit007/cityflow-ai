import { redirect } from "next/navigation";
import { AppShell, Card } from "@cityflow/ui";

import { DeleteAccount, SignOutButton } from "@/components/account-actions";
import { CityBackdrop } from "@/components/city-backdrop";
import { TravellerNav } from "@/components/traveller-nav";
import { cityByCode } from "@/lib/cities";
import { pool } from "@/lib/db";
import { fullDate } from "@/lib/localtime";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

interface Summary {
  created_at: string;
  home_city: string;
  routines: number;
  trips: number;
  points: number;
}

export default async function AccountPage() {
  const session = await readSession();
  if (!session) redirect("/signin");

  const { rows } = await pool().query<Summary>(
    `SELECT i.created_at,
            i.home_city,
            (SELECT count(*) FROM routines      r WHERE r.identity_id = i.id) AS routines,
            (SELECT count(*) FROM trips         t WHERE t.identity_id = i.id) AS trips,
            (SELECT coalesce(sum(p.points), 0)
               FROM points_ledger p WHERE p.identity_id = i.id)               AS points
       FROM city_identities i
      WHERE i.id = $1`,
    [session.identityId],
  );

  const summary = rows[0];
  if (!summary) redirect("/signin");

  const city = cityByCode(summary.home_city);

  return (
    <AppShell
      productName="CityFlow AI"
      backdrop={<CityBackdrop city={session.cityId.slice(0, 3)} />}
      nav={<TravellerNav current="account" />}
    >
      <h1 className="text-2xl font-semibold tracking-tight">Account</h1>

      <Card className="mt-6 max-w-xl">
        <h2 className="text-sm font-semibold">Your City ID</h2>
        <p className="mt-2 font-mono text-lg tracking-wide">{session.cityId}</p>
        <p className="mt-3 text-sm text-[var(--ink-muted)]">
          {city ? city.name : summary.home_city}, since{" "}
          {fullDate(new Date(summary.created_at))}. There is no name, email or phone
          number attached to it, and no column in the database to put one in.
        </p>
      </Card>

      <div className="mt-4 grid max-w-xl gap-4 sm:grid-cols-3">
        <Figure label="Routines" value={summary.routines} />
        <Figure label="Journeys planned" value={summary.trips} />
        <Figure label="Points" value={summary.points} />
      </div>

      <Card className="mt-8 max-w-xl">
        <h2 className="text-sm font-semibold">Signing out</h2>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          You will need your City ID and recovery phrase to get back in. Nothing else can
          identify you.
        </p>
        <div className="mt-4">
          <SignOutButton />
        </div>
      </Card>

      <Card className="mt-4 max-w-xl">
        <h2 className="text-sm font-semibold">Delete this account</h2>
        <DeleteAccount cityId={session.cityId} />
      </Card>
    </AppShell>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-xs text-[var(--ink-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}
