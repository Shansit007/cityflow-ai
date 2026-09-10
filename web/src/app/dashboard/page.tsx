import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { CITY_COOKIE_NAME } from "@/components/city/city-provider";
import { HistoryCard } from "@/components/dashboard/history-card";
import { PeakStrip } from "@/components/dashboard/peak-strip";
import { RecommendationCard } from "@/components/dashboard/recommendation-card";
import { UpdateNotice } from "@/components/dashboard/update-notice";
import {
  RoadConditionsCard,
  RoutineCard,
  TrafficStatusCard,
  TravelOptionsCard,
} from "@/components/dashboard/status-cards";
import { MapPanel } from "@/components/map/map-panel";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Notice } from "@/components/ui/input";
import { appHour, formatAppDate } from "@/lib/app-time";
import { getCurrentUser } from "@/lib/auth/session";
import { getCity } from "@/lib/cities";
import { DEMAND_LEVEL_LABEL } from "@/lib/demand/demand-model";
import {
  loadRecommendationHistory,
  loadTodayForUser,
} from "@/lib/recommendation-service";
import { greetingForHour } from "@/lib/utils";

export const metadata: Metadata = {
  title: "My dashboard",
};

/**
 * The commuter dashboard.
 *
 * It is built to answer one question above all others, in the first screenful:
 * WHEN SHOULD I LEAVE TODAY? Everything else — the demand strip, the map, the
 * routine, travel options, history — exists to support or explain that answer.
 *
 * This is a server component. It loads the data, runs the recommendation engine
 * and hands finished values to the display components, so the browser never has
 * to fetch anything before showing the answer.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // A user without a routine cannot be given a recommendation, so send them to
  // set one up rather than showing a dashboard full of empty cards.
  const params = await searchParams;

  // The city shown must match the city the demand numbers were computed for.
  // The selector writes a cookie; the profile stores a fallback.
  const cookieStore = await cookies();
  const cityCode = cookieStore.get(CITY_COOKIE_NAME)?.value ?? user.cityCode;
  const city = getCity(cityCode);

  const today = await loadTodayForUser(user.id, city.code);

  if (!today.profile) redirect("/onboarding");

  const history = await loadRecommendationHistory(user.id);

  const greeting = greetingForHour(appHour());
  const name = user.displayName ?? "there";
  const engine = today.engine!;
  const recommendation = today.recommendation!;

  return (
    <section className="py-8 sm:py-12">
      <Container width="wide">
        {/* ------------------------------------------------------- greeting */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              {greeting}, {name}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {formatAppDate()}
              <span className="mx-2 text-border-strong" aria-hidden="true">
                ·
              </span>
              {city.name}
              <span className="mx-2 text-border-strong" aria-hidden="true">
                ·
              </span>
              CityFlow ID{" "}
              <span className="font-mono font-medium text-fg">{user.cityflowId}</span>
            </p>
          </div>

          <ButtonLink href="/profile" variant="outline" size="sm">
            Edit my routine
          </ButtonLink>
        </div>

        {/*
          Shown when the city-wide optimiser moved this person's time because
          other people's confirmed plans changed the demand picture.
        */}
        {recommendation.updatedByOptimiser &&
          !recommendation.updateAcknowledged &&
          recommendation.updateReason && (
            <div className="mt-6">
              <UpdateNotice reason={recommendation.updateReason} />
            </div>
          )}

        {params.welcome === "1" && (
          <div className="mt-6">
            <Notice tone="success">
              Your CityFlow profile is ready. Here is your first departure recommendation.
            </Notice>
          </div>
        )}

        {/* -------------------------------------- the answer, above the fold */}
        <div className="mt-8">
          <RecommendationCard
            recommendedDeparture={engine.recommendedDeparture}
            usualDeparture={engine.usualDeparture}
            requiredArrival={today.profile.requiredArrival}
            estimatedArrival={engine.estimatedArrival}
            estimatedJourneyMinutes={engine.estimatedJourneyMinutes}
            demandAtUsual={engine.demandAtUsual}
            demandAtRecommended={engine.demandAtRecommended}
            levelAtUsual={engine.levelAtUsual}
            levelAtRecommended={engine.levelAtRecommended}
            levelLabelAtUsual={DEMAND_LEVEL_LABEL[engine.levelAtUsual]}
            levelLabelAtRecommended={DEMAND_LEVEL_LABEL[engine.levelAtRecommended]}
            suggestsChange={engine.suggestsChange}
            reason={engine.reason}
            benefit={engine.benefit}
            warning={engine.warning}
            initialStatus={recommendation.status}
            initialChosenDeparture={recommendation.chosenDeparture}
          />
        </div>

        {/* ------------------------------------------- supporting information */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PeakStrip
              slots={today.peakStrip}
              usualDeparture={engine.usualDeparture}
              recommendedDeparture={engine.recommendedDeparture}
            />
          </div>

          <TrafficStatusCard now={today.now} cityName={city.name} />
        </div>

        {/* ------------------------------------------------------------ map */}
        <div className="mt-6">
          <MapPanel demandLevel={today.now.level} demandLabel={today.now.label} />
        </div>

        {/* --------------------------------------------------- routine & co. */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <RoutineCard profile={today.profile} />
          <TravelOptionsCard profile={today.profile} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <RoadConditionsCard area={today.profile.homeArea} />
          <HistoryCard recommendations={history} />
        </div>

        {/* ------------------------------------------------- honesty footer */}
        <div className="mt-8 rounded-card border border-border-base bg-surface-2 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="neutral">How to read this page</Badge>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Every demand figure here is a <span className="font-medium text-fg">prediction</span>{" "}
            from CityFlow AI&apos;s demand model, not a live measurement of traffic. Journey and
            arrival estimates are based on the normal journey time you entered. Recommendations
            are suggestions — you always decide when to leave, and choosing your usual time is
            never wrong.
          </p>
        </div>
      </Container>
    </section>
  );
}
