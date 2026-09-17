import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, Card } from "@cityflow/ui";

import { CityBackdrop } from "@/components/city-backdrop";
import { TravellerNav } from "@/components/traveller-nav";
import { pool } from "@/lib/db";
import { shortDate } from "@/lib/localtime";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

type Source =
  "followed_recommendation" | "defect_confirmed" | "routine_kept" | "adjustment";

const REASON: Record<Source, string> = {
  followed_recommendation: "Left at the recommended time",
  defect_confirmed: "Reported a defect others confirmed",
  routine_kept: "Kept a routine for a full week",
  adjustment: "Manual adjustment",
};

interface Entry {
  id: string;
  points: number;
  source: Source;
  created_at: string;
}

export default async function RewardsPage() {
  const session = await readSession();
  if (!session) redirect("/signin");

  const { rows } = await pool().query<Entry>(
    `SELECT id, points, source, created_at
       FROM points_ledger
      WHERE identity_id = $1
      ORDER BY created_at DESC
      LIMIT 100`,
    [session.identityId],
  );

  // Summed from the rows rather than stored, which is what makes a balance explainable:
  // every point in it has an entry underneath saying where it came from.
  const balance = rows.reduce((total, entry) => total + entry.points, 0);

  return (
    <AppShell
      productName="CityFlow AI"
      backdrop={<CityBackdrop city={session.cityId.slice(0, 3)} />}
      nav={<TravellerNav current="rewards" />}
    >
      <h1 className="text-2xl font-semibold tracking-tight">Rewards</h1>

      <Card className="mt-6 max-w-xl border-[var(--line-strong)]">
        <h2 className="text-sm font-semibold">This is a simulation</h2>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          These points are not redeemable, are not money, and no partner, transport
          authority or retailer has agreed to honour them. They exist to show what an
          incentive scheme built on this data could look like, and what it would have to
          pay out. The proposed operating model is in the project documentation.
        </p>
      </Card>

      <div className="mt-6 max-w-xl">
        <p className="text-xs text-[var(--ink-muted)]">Balance</p>
        <p className="mt-1 text-4xl font-semibold tabular-nums">{balance}</p>
      </div>

      {rows.length === 0 ? (
        <Card className="mt-6 max-w-xl">
          <h2 className="text-sm font-semibold">Nothing earned yet</h2>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            Points are awarded for leaving at a recommended time and for reporting a road
            defect that other travellers then confirm. Neither has happened on this
            account yet.
          </p>
          <Link
            href="/today"
            className="mt-4 inline-block text-sm font-medium text-[var(--accent)]"
          >
            See today&rsquo;s plan
          </Link>
        </Card>
      ) : (
        <table className="mt-6 w-full max-w-xl text-sm">
          <caption className="sr-only">Every points entry on this account</caption>
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-[var(--ink-muted)]">
              <th scope="col" className="py-2 font-medium">
                Why
              </th>
              <th scope="col" className="py-2 font-medium">
                When
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Points
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => (
              <tr key={entry.id} className="border-b border-[var(--line)]">
                <td className="py-3">{REASON[entry.source]}</td>
                <td className="py-3 text-[var(--ink-muted)]">
                  {shortDate(new Date(entry.created_at))}
                </td>
                <td className="py-3 text-right tabular-nums">
                  {entry.points > 0 ? `+${entry.points}` : entry.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AppShell>
  );
}
