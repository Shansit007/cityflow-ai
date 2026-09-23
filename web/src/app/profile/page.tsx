import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CityflowIdCard } from "@/components/auth/cityflow-id-card";
import { ProfileCompleteness } from "@/components/profile/completeness";
import { ProfileForm } from "@/components/profile/profile-form";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import type { TravelProfileInput } from "@/lib/validation";

export const metadata: Metadata = {
  title: "My profile",
  description: "View and edit your CityFlow AI travel routine and privacy settings.",
};

/**
 * My profile — view and edit everything the system knows.
 *
 * Onboarding promised the routine could be changed or removed at any time. This
 * page is where that promise is kept, so it shows the same four sections in the
 * same order, with nothing hidden away.
 */
export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [profile, confirmedPlans, journeys] = await Promise.all([
    prisma.travelProfile.findUnique({ where: { userId: user.id } }),
    prisma.travelIntention.count({
      where: { userId: user.id, status: "CONFIRMED" },
    }),
    prisma.journey.findMany({ where: { userId: user.id } }),
  ]);

  // Nothing to edit yet — send them through onboarding first.
  if (!profile) redirect("/onboarding");

  const journeyCount = journeys.length;

  /*
    With exactly one routine, that Journey — not the legacy TravelProfile
    columns — is the truth for where/when this person travels (see the
    matching comment in api/profile/route.ts). Seeding the form from it means
    what the person sees here always matches their actual routine, and saving
    it back can never clobber a Journey field (a since-adjusted departure
    time, say) with a stale TravelProfile default they never touched.
  */
  const soleJourney = journeyCount === 1 ? journeys[0] : null;

  // Convert the database row into the exact shape the form works with.
  const initial: TravelProfileInput = {
    homeArea: soleJourney?.originArea ?? profile.homeArea,
    destinationArea: soleJourney?.destinationArea ?? profile.destinationArea,
    destinationType: soleJourney?.destinationType ?? profile.destinationType,
    primaryMode: soleJourney?.mode ?? profile.primaryMode,
    usualDeparture: soleJourney?.usualDeparture ?? profile.usualDeparture,
    requiredArrival: soleJourney?.requiredArrival ?? profile.requiredArrival,
    typicalJourneyMinutes:
      soleJourney?.typicalJourneyMinutes ?? profile.typicalJourneyMinutes,
    travelDays: (soleJourney?.travelDays ?? profile.travelDays) as TravelProfileInput["travelDays"],
    isFlexible: soleJourney?.isFlexible ?? profile.isFlexible,
    flexibilityMinutes: soleJourney?.flexibilityMinutes ?? profile.flexibilityMinutes,
    preferredModes: profile.preferredModes,
    maxAcceptableDelayMinutes: profile.maxAcceptableDelayMinutes,
    willingToLeaveEarlier: soleJourney?.willingToLeaveEarlier ?? profile.willingToLeaveEarlier,
    willingToLeaveLater: soleJourney?.willingToLeaveLater ?? profile.willingToLeaveLater,
    carpoolInterest: profile.carpoolInterest,
    publicTransportInterest: profile.publicTransportInterest,
    shareAggregatedDemand: profile.shareAggregatedDemand,
    allowNotifications: profile.allowNotifications,
  };

  return (
    <section className="py-8 sm:py-12">
      <Container width="default">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              My profile
            </h1>
            <p className="mt-2 text-sm text-muted">
              Everything CityFlow AI knows about your travel routine. Change any of it,
              any time.
            </p>
          </div>
          <ButtonLink href="/settings" variant="outline" size="sm">
            Account settings
          </ButtonLink>
        </div>

        <div className="mt-6">
          <CityflowIdCard cityflowId={user.cityflowId} />
        </div>

        <div className="mt-4 rounded-card border border-border-base bg-surface p-5">
          <h2 className="text-sm font-semibold text-fg">Account</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted">Email</dt>
              <dd className="font-medium text-fg">{user.email}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted">Display name</dt>
              <dd className="font-medium text-fg">{user.displayName ?? "Not set"}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-subtle">
            Your email is used only for signing in, account recovery and important service
            messages. It is never used in traffic analysis or shown in city-level reporting.
          </p>
        </div>

        <div className="mt-4">
          <ProfileCompleteness
            hasDisplayName={Boolean(user.displayName)}
            hasCity={Boolean(user.cityCode)}
            isFlexible={profile.isFlexible}
            hasConfirmedPlan={confirmedPlans > 0}
            hasPreferredModes={profile.preferredModes.length > 0}
            sharesDemand={profile.shareAggregatedDemand}
            allowsNotifications={profile.allowNotifications}
          />
        </div>

        <div className="mt-8">
          <ProfileForm initial={initial} journeyCount={journeyCount} />
        </div>
      </Container>
    </section>
  );
}
