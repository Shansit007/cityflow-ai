import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { Container } from "@/components/ui/container";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Set up your travel routine",
  description:
    "Tell CityFlow AI about your regular travel routine so it can suggest departure times that suit you.",
};

/**
 * Onboarding.
 *
 * A new user lands here after signing up, BEFORE the dashboard. Throwing
 * someone straight into a dashboard that knows nothing about them would show
 * empty cards and no recommendation — the opposite of a useful first
 * impression.
 *
 * Someone who has already completed onboarding is sent to their dashboard
 * instead; editing an existing routine belongs on /profile.
 */
export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const existing = await prisma.travelProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (existing) redirect("/dashboard");

  return (
    <section className="py-10 sm:py-14">
      <Container width="default">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
          Setting up
        </p>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          Let&apos;s understand your regular travel routine
        </h1>

        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          Four short steps. CityFlow AI uses this to work out when demand is likely to peak on
          your route, and whether a small change to your departure time would help. You can
          edit all of it later.
        </p>

        <div className="mt-8">
          <OnboardingFlow />
        </div>

        <p className="mt-6 text-xs leading-relaxed text-subtle">
          Your answers are stored against your anonymous CityFlow ID. Step 4 explains exactly
          what is kept and what is not.
        </p>
      </Container>
    </section>
  );
}
