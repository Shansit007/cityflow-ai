import type { Metadata } from "next";

import { CitySwitcher } from "@/components/admin/city-switcher";
import { BreakdownBarPanel, StatTile } from "@/components/admin/panels";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { loadUserAnalytics } from "@/lib/admin/user-analytics";
import { formatAppDate } from "@/lib/app-time";
import { getCity } from "@/lib/cities";

export const metadata: Metadata = { title: "User analytics" };

/**
 * Admin Portal — User Analytics.
 *
 * Where the City overview page answers "how much demand is there", this page
 * answers "who has an account, and where are they in the lifecycle from
 * sign-up to an active, counted commuter" — see lib/admin/user-analytics.ts
 * for the full reasoning and the privacy rule every query here follows.
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const params = await searchParams;
  const city = getCity(params.city);

  const analytics = await loadUserAnalytics(city.code);

  const signupDelta = analytics.newThisWeek - analytics.newPreviousWeek;

  return (
    <section className="py-8">
      <Container width="wide">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              User analytics
            </h1>
            <p className="mt-2 text-sm text-muted">
              {city.name} · {formatAppDate()}
            </p>
          </div>

          <CitySwitcher active={city.code} basePath="/admin/users" />
        </div>

        {/* ------------------------------------------------------- top tiles */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Registered accounts"
            value={String(analytics.totalUsers)}
            detail={`in ${city.name}`}
          />
          <StatTile
            label="Completed onboarding"
            value={String(analytics.onboarded)}
            detail={
              analytics.onboardingRate === null
                ? "No accounts yet"
                : `${analytics.onboardingRate}% of registered accounts`
            }
          />
          <StatTile
            label="Email verified"
            value={String(analytics.emailVerified)}
            detail={
              analytics.totalUsers > 0
                ? `${Math.round((analytics.emailVerified / analytics.totalUsers) * 100)}% of accounts`
                : "No accounts yet"
            }
          />
          <StatTile
            label="Avg. journeys per onboarded account"
            value={
              analytics.avgJourneysPerOnboarded === null
                ? "—"
                : String(analytics.avgJourneysPerOnboarded)
            }
            detail="Recurring routines saved, per person who finished onboarding"
          />
        </div>

        {/* --------------------------------------------------------- panels */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Sign-ups"
              description="New accounts this week compared with the previous seven days."
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-subtle">
                  This week
                </p>
                <p className="mt-1.5 text-3xl font-semibold tracking-tight text-fg">
                  {analytics.newThisWeek}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-subtle">
                  Previous week
                </p>
                <p className="mt-1.5 text-3xl font-semibold tracking-tight text-fg">
                  {analytics.newPreviousWeek}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-subtle">
              {signupDelta === 0
                ? "The same number of people signed up this week as the week before."
                : signupDelta > 0
                  ? `${signupDelta} more sign-up${signupDelta === 1 ? "" : "s"} than the previous week.`
                  : `${Math.abs(signupDelta)} fewer sign-up${Math.abs(signupDelta) === 1 ? "" : "s"} than the previous week.`}
            </p>
          </Card>

          <BreakdownBarPanel
            title="Privacy choices"
            description="What people chose during onboarding for how visible their activity is."
            rows={[
              { label: "Anonymous", value: analytics.privacy.anonymous },
              { label: "Partial", value: analytics.privacy.partial, tone: "secondary" },
              { label: "Full", value: analytics.privacy.full },
            ]}
            emptyMessage="No accounts have made a privacy choice yet."
          />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <StatTile
            label="Opted out of city-level counting"
            value={String(analytics.optedOutOfDemand)}
            detail="Switched off being counted in aggregated demand totals"
          />
          <StatTile
            label="Linked to an organisation"
            value={String(analytics.linkedToOrganisation)}
            detail="Accounts joined to a workplace or institution"
          />
        </div>

        {/* ------------------------------------------------- privacy notice */}
        <div className="mt-8 rounded-card border border-border-base bg-surface-2 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="secondary">Privacy</Badge>
          </div>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-muted">
            Every figure on this page is a count. The queries behind it never select an
            email, a display name, a phone number or any other column that identifies a
            specific account — see{" "}
            <span className="font-medium text-fg">User Management</span> for the one place
            individual accounts appear, and what is deliberately left out even there.
          </p>
        </div>
      </Container>
    </section>
  );
}
