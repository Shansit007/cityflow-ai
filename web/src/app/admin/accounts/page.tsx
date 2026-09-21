import type { Metadata } from "next";

import { CitySwitcher } from "@/components/admin/city-switcher";
import { EmptyNote } from "@/components/admin/panels";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { loadUserAccounts } from "@/lib/admin/user-analytics";
import { formatAppDate } from "@/lib/app-time";
import { getCity } from "@/lib/cities";

export const metadata: Metadata = { title: "User management" };

const PRIVACY_LABEL: Record<string, string> = {
  ANONYMOUS: "Anonymous",
  PARTIAL: "Partial",
  FULL: "Full",
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Admin Portal — User Management.
 *
 * A read-only list of accounts in one city. This is the one Admin Portal view
 * where an individual row is visible at all — see lib/admin/user-analytics.ts
 * for exactly what is and is not selected, and why. There is deliberately no
 * edit, suspend or role-change action here: those are account mutations with
 * real consequences for a real person, and belong behind their own careful,
 * audited workflow rather than being added quickly onto a read view.
 */
export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const params = await searchParams;
  const city = getCity(params.city);

  const { rows, totalCount, truncated } = await loadUserAccounts(city.code);

  return (
    <section className="py-8">
      <Container width="wide">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              User management
            </h1>
            <p className="mt-2 text-sm text-muted">
              {city.name} · {formatAppDate()} · {totalCount} account{totalCount === 1 ? "" : "s"}
            </p>
          </div>

          <CitySwitcher active={city.code} basePath="/admin/accounts" />
        </div>

        <Card className="mt-6">
          <CardHeader
            title="Accounts"
            description="Ordered by newest first. CityFlow ID is the same anonymous identifier used everywhere else in the product — nothing here can be traced to an email, name or phone number."
          />

          {rows.length === 0 ? (
            <EmptyNote>No accounts have been registered in this city yet.</EmptyNote>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] border-collapse text-sm">
                <caption className="sr-only-cf">
                  Registered accounts in {city.name}, newest first
                </caption>
                <thead>
                  <tr className="border-b border-border-base text-left text-xs uppercase tracking-wide text-subtle">
                    <th scope="col" className="py-2 pr-3 font-medium">
                      CityFlow ID
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Onboarding
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Email
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Privacy
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Organisation
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-border-base last:border-0">
                      <td className="py-2.5 pr-3 font-mono text-xs text-fg">{row.cityflowId}</td>
                      <td className="py-2.5 pr-3">
                        <Badge tone={row.onboardingCompleted ? "low" : "neutral"}>
                          {row.onboardingCompleted ? "Complete" : "In progress"}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge tone={row.emailVerified ? "low" : "neutral"}>
                          {row.emailVerified ? "Verified" : "Unverified"}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3 text-muted">
                        {PRIVACY_LABEL[row.privacyLevel] ?? row.privacyLevel}
                      </td>
                      <td className="py-2.5 pr-3 text-muted">
                        {row.organisationLinked ? "Linked" : "—"}
                      </td>
                      <td className="py-2.5 text-muted">{formatDate(row.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {truncated && (
            <p className="mt-4 text-xs leading-relaxed text-subtle">
              Showing the most recent {rows.length} of {totalCount} accounts.
            </p>
          )}
        </Card>

        {/* ------------------------------------------------- privacy notice */}
        <div className="mt-8 rounded-card border border-border-base bg-surface-2 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="secondary">Privacy</Badge>
          </div>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-muted">
            This table never selects an email address, display name, phone number, profile
            picture, or anything from a travel profile, journey or chat history — the
            boundary is in the query in lib/admin/user-analytics.ts, not just in this page.
            An operator who genuinely needs to contact someone still has the database; this
            view exists for understanding the accounts in a city at a glance, not for
            looking someone up by name.
          </p>
        </div>
      </Container>
    </section>
  );
}
