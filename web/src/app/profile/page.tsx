import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CityflowIdCard } from "@/components/auth/cityflow-id-card";
import { ProfileForm } from "@/components/profile/profile-form";
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

  const profile = await prisma.travelProfile.findUnique({
    where: { userId: user.id },
  });

  // Nothing to edit yet — send them through onboarding first.
  if (!profile) redirect("/onboarding");

  // Convert the database row into the exact shape the form works with.
  const initial: TravelProfileInput = {
    homeArea: profile.homeArea,
    destinationArea: profile.destinationArea,
    destinationType: profile.destinationType,
    primaryMode: profile.primaryMode,
    usualDeparture: profile.usualDeparture,
    requiredArrival: profile.requiredArrival,
    typicalJourneyMinutes: profile.typicalJourneyMinutes,
    travelDays: profile.travelDays as TravelProfileInput["travelDays"],
    isFlexible: profile.isFlexible,
    flexibilityMinutes: profile.flexibilityMinutes,
    preferredModes: profile.preferredModes,
    maxAcceptableDelayMinutes: profile.maxAcceptableDelayMinutes,
    willingToLeaveEarlier: profile.willingToLeaveEarlier,
    willingToLeaveLater: profile.willingToLeaveLater,
    carpoolInterest: profile.carpoolInterest,
    publicTransportInterest: profile.publicTransportInterest,
    shareAggregatedDemand: profile.shareAggregatedDemand,
    allowNotifications: profile.allowNotifications,
  };

  return (
    <section className="py-8 sm:py-12">
      <Container width="default">
        <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          My profile
        </h1>
        <p className="mt-2 text-sm text-muted">
          Everything CityFlow AI knows about your travel routine. Change any of it, any time.
        </p>

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

        <div className="mt-8">
          <ProfileForm initial={initial} />
        </div>
      </Container>
    </section>
  );
}
