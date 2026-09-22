import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { HistoryCard } from "@/components/dashboard/history-card";
import { JourneyList } from "@/components/journeys/journey-list";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { getCurrentUser } from "@/lib/auth/session";
import {
  MAX_JOURNEYS_PER_USER,
  listJourneys,
} from "@/lib/journeys/journey-service";
import { loadRecommendationHistory } from "@/lib/recommendation-service";

export const metadata: Metadata = {
  title: "My journeys",
};

/**
 * Manage recurring journeys.
 *
 * A person's routines are the single most important thing they tell CityFlow AI
 * — everything the product does downstream is derived from them — so they get
 * their own page rather than being buried in profile settings.
 */
export default async function JourneysPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/journeys");

  // Independent queries — run together rather than one waiting on the other.
  const [journeys, history] = await Promise.all([
    listJourneys(user.id),
    loadRecommendationHistory(user.id),
  ]);
  const atLimit = journeys.length >= MAX_JOURNEYS_PER_USER;

  return (
    <section className="py-8 sm:py-12">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            eyebrow="Your routines"
            title="My journeys"
            description="The trips you make regularly. CityFlow AI suggests a departure time for each one, on the days it runs."
          />

          {!atLimit && <ButtonLink href="/journeys/new">Add a journey</ButtonLink>}
        </div>

        {atLimit && (
          <p className="mt-4 rounded-lg border border-border-base bg-surface-2 px-4 py-3 text-sm text-muted">
            You have reached the maximum of {MAX_JOURNEYS_PER_USER} saved journeys. Delete
            one you no longer use to add another.
          </p>
        )}

        <div className="mt-6">
          <JourneyList
            journeys={journeys.map((journey) => ({
              id: journey.id,
              label: journey.label,
              originArea: journey.originArea,
              destinationArea: journey.destinationArea,
              usualDeparture: journey.usualDeparture,
              requiredArrival: journey.requiredArrival,
              travelDays: journey.travelDays,
              isFlexible: journey.isFlexible,
              flexibilityMinutes: journey.flexibilityMinutes,
              isActive: journey.isActive,
              mode: journey.mode,
            }))}
          />
        </div>

        <div className="mt-8">
          <HistoryCard recommendations={history} />
        </div>
      </Container>
    </section>
  );
}
