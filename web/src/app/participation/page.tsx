import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { ImpactDashboard } from "@/components/participation/impact-dashboard";
import { loadModelledImpact } from "@/lib/admin/analytics";
import { getCurrentUser } from "@/lib/auth/session";
import { getCity } from "@/lib/cities";
import { formatDuration } from "@/lib/demand/time-slots";
import { loadParticipationSummary } from "@/lib/participation";

export const metadata: Metadata = {
  title: "My CityFlow participation",
  description: "What you have contributed to CityFlow AI, and what it did.",
};

/**
 * My CityFlow participation.
 *
 * ============================ THE RULE FOR THIS PAGE ========================
 * Every number here is something the system actually observed. There is no
 * "time saved", no "CO₂ avoided", no "you helped 1,200 commuters" — CityFlow AI
 * measured none of those, and a made-up impact figure on a page designed to
 * make somebody feel good about participating is the most dishonest thing this
 * product could do.
 *
 * The rewards section is real about itself too. Nothing is offered today. The
 * ideas are listed as POSSIBLE FUTURE BENEFITS, with a plain statement that
 * they do not exist and nothing is being earned towards them. Fake points would
 * be worse than no points.
 * ============================================================================
 */
export default async function ParticipationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/participation");

  const city = getCity(user.cityCode);

  const [summary, cityImpactToday] = await Promise.all([
    loadParticipationSummary(user.id),
    loadModelledImpact(city.code, new Date()),
  ]);

  const flexibilityOffered = summary.timesAcceptedSuggestion + summary.timesChoseOwnTime;

  return (
    <section className="py-8 sm:py-12">
      <Container>
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            My CityFlow participation
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Everything on this page is something CityFlow AI actually recorded. Member since{" "}
            {summary.memberSince.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            , as{" "}
            <span className="font-mono font-medium text-fg">{user.cityflowId}</span>.
          </p>
        </header>

        {/* ------------------------------------------------------- headline */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Days with a plan"
            value={String(summary.daysWithRecommendation)}
            detail={`${summary.daysDecided} of them you answered`}
          />
          <Metric
            label="Plans confirmed"
            value={String(summary.plansConfirmed)}
            detail="Counted in the city's demand curve"
          />
          <Metric
            label="Flexibility offered"
            value={String(flexibilityOffered)}
            detail="Days you moved away from your usual time"
          />
          <Metric
            label="Total shift"
            value={
              summary.totalMinutesShifted > 0
                ? formatDuration(summary.totalMinutesShifted)
                : "—"
            }
            detail="How far your departures moved in total"
          />
        </div>

        <ImpactDashboard personal={summary.personalImpact} city={cityImpactToday} cityName={city.name} />

        {/* ------------------------------------------------ what it means */}
        <Card className="mt-6">
          <CardHeader title="What your participation actually did" />

          {summary.plansConfirmed === 0 ? (
            <div className="rounded-lg border border-dashed border-border-strong bg-surface-2 p-5">
              <p className="text-sm leading-relaxed text-muted">
                You have not confirmed a travel plan yet. Confirming one — from the dashboard
                or by telling{" "}
                <Link
                  href="/assistant"
                  className="font-medium text-primary underline underline-offset-2"
                >
                  the assistant
                </Link>{" "}
                when you are leaving — is what puts your trip into the city&apos;s demand
                figures, which is what lets everybody else&apos;s recommendation take you into
                account.
              </p>
            </div>
          ) : (
            <ul className="space-y-3 text-sm leading-relaxed text-muted">
              <li>
                <span className="font-medium text-fg">
                  {summary.plansConfirmed} confirmed plan
                  {summary.plansConfirmed === 1 ? "" : "s"}
                </span>{" "}
                {summary.countedInCityFigures ? (
                  <>
                    were added to your city&apos;s demand curve. Once a slot fills up, the next
                    person asking is steered somewhere quieter — that is the whole mechanism,
                    and it only works because people confirm.
                  </>
                ) : (
                  <>
                    were recorded for you. You have switched off &ldquo;count my trip in
                    city-level demand totals&rdquo;, so they are not included in city figures —
                    which is entirely your choice and is respected everywhere.
                  </>
                )}
              </li>

              {flexibilityOffered > 0 && (
                <li>
                  <span className="font-medium text-fg">
                    You moved your departure on {flexibilityOffered} day
                    {flexibilityOffered === 1 ? "" : "s"}
                  </span>
                  , by {formatDuration(summary.totalMinutesShifted)} in total. Every one of
                  those left a little more room in the slot you would otherwise have been in.
                </li>
              )}

              {summary.timesKeptUsualTime > 0 && (
                <li>
                  You kept your usual time on{" "}
                  <span className="font-medium text-fg">{summary.timesKeptUsualTime} day</span>
                  {summary.timesKeptUsualTime === 1 ? "" : "s"}. That is a perfectly good
                  answer — a recommendation is a suggestion, and telling us you are not moving
                  is more useful than silence.
                </li>
              )}

              {summary.timesRecommendationAdjusted > 0 && (
                <li>
                  Your recommendation was adjusted{" "}
                  <span className="font-medium text-fg">
                    {summary.timesRecommendationAdjusted} time
                    {summary.timesRecommendationAdjusted === 1 ? "" : "s"}
                  </span>{" "}
                  because other people confirmed plans that changed the picture.
                </li>
              )}
            </ul>
          )}

          <p className="mt-5 border-t border-border-base pt-4 text-xs leading-relaxed text-subtle">
            You may notice there is no &ldquo;time saved&rdquo; figure here. CityFlow AI does
            not measure your real journeys, so any such number would be invented. What it can
            honestly show is what you did.
          </p>
        </Card>

        {/* ------------------------------------------------ road reporting */}
        <Card className="mt-6">
          <CardHeader
            title="Road issues you reported"
            action={
              <ButtonLink href="/roads" variant="outline" size="sm">
                Report an issue
              </ButtonLink>
            }
          />

          {summary.roadIssuesReported + summary.roadSensorDetections === 0 ? (
            <p className="text-sm leading-relaxed text-muted">
              You have not reported a road issue yet. A report takes about thirty seconds and
              goes into the prioritised list CityFlow AI hands to the municipal road-maintenance
              team.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Metric
                label="Reports you filled in"
                value={String(summary.roadIssuesReported)}
                detail="Full weight — you looked at it yourself"
              />
              <Metric
                label="Detected by your phone"
                value={String(summary.roadSensorDetections)}
                detail="Half weight — a jolt is a hint, not an observation"
              />
            </div>
          )}
        </Card>

        {/* ------------------------------------------- possible future benefits */}
        <Card className="mt-6">
          <CardHeader
            title="Possible future benefits"
            action={<Badge tone="neutral">Not available</Badge>}
          />

          <div className="rounded-lg border border-border-strong bg-surface-2 p-4">
            <p className="text-sm font-medium text-fg">
              None of the following exists. Nothing is being earned.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              These are ideas that have been discussed for a future version of CityFlow AI, and
              every one of them would need a city or transport authority to agree to it — which
              has not happened. They are listed so you can see where the project might go, not
              as something you are working towards. No points are being counted, and your
              participation is not being banked against a reward.
            </p>
          </div>

          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
            <FutureIdea
              title="Public-transport concessions for flexible travellers"
              body="A discount on a metro or bus pass for commuters who regularly shift out of the peak. Would require an agreement with the transport operator."
            />
            <FutureIdea
              title="Priority in employer flexible-hours schemes"
              body="Aggregated, anonymous evidence that an office's staff can spread their arrivals, which an employer could use to justify staggered hours. Would require the employer's participation."
            />
            <FutureIdea
              title="Recognition for road reporting"
              body="Acknowledgement for people whose reports lead to a repair. Would require the municipal system to tell CityFlow AI when something was fixed — today it does not."
            />
            <FutureIdea
              title="Neighbourhood travel insights"
              body="A view of how your area's travel pattern is changing over time, built from aggregated data. This one needs no external agreement, only more data than exists today."
            />
          </ul>
        </Card>

        {/* --------------------------------------------------------- privacy */}
        <Card className="mt-6">
          <CardHeader title="What this page can see" />
          <ul className="space-y-2 text-sm leading-relaxed text-muted">
            <li>
              This page is <span className="font-medium text-fg">yours alone</span>. Nobody
              else, including the Admin Portal, can see your individual figures — city-level
              analysis works on counts and averages and does not select a person.
            </li>
            <li>
              Your{" "}
              <span className="font-mono text-fg">{user.cityflowId}</span> is the anonymous
              identifier used everywhere except signing in. Your email address is used for
              authentication and account recovery only.
            </li>
            <li>
              You can change whether your trips are counted in city figures at any time from{" "}
              <Link
                href="/profile"
                className="font-medium text-primary underline underline-offset-2"
              >
                your profile
              </Link>
              . It is currently{" "}
              <span className="font-medium text-fg">
                {summary.countedInCityFigures ? "on" : "off"}
              </span>
              .
            </li>
          </ul>
        </Card>
      </Container>
    </section>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-card border border-border-base bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-subtle">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums text-fg">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{detail}</p>
    </div>
  );
}

function FutureIdea({ title, body }: { title: string; body: string }) {
  return (
    <li className="border-l-2 border-border-strong pl-4">
      <p className="text-sm font-medium text-fg">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{body}</p>
    </li>
  );
}
