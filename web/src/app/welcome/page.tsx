import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CityflowIdCard } from "@/components/auth/cityflow-id-card";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Welcome to CityFlow AI",
};

/**
 * Shown once, right after sign-up.
 *
 * Its only job is to introduce the anonymous CityFlow ID and explain the privacy
 * model before the user goes any further. The travel-routine onboarding that
 * follows this screen is built in Phase 2.
 */
export default async function WelcomePage() {
  const user = await getCurrentUser();

  // The middleware already guards this route; this is a second safety net for
  // the case where the session is valid but the account no longer exists.
  if (!user) redirect("/login");

  const greetingName = user.displayName ?? "there";

  return (
    <section className="py-14 sm:py-20">
      <Container width="narrow">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
          Account created
        </p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg">
          Welcome, {greetingName}.
        </h1>

        <p className="mt-4 text-base leading-relaxed text-muted">
          Your CityFlow AI account is ready. Here is the anonymous ID that will carry your
          travel preferences from now on.
        </p>

        <div className="mt-8">
          <CityflowIdCard cityflowId={user.cityflowId} />
        </div>

        {/* What we store, and what we do not. Stated plainly, before onboarding. */}
        <div className="mt-8 rounded-card border border-border-base bg-surface p-5 sm:p-6">
          <h2 className="text-base font-semibold text-fg">What happens with your data</h2>

          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="font-medium text-fg">Your email</dt>
              <dd className="mt-0.5 leading-relaxed text-muted">
                Used for signing in, account recovery and important service messages. It is
                not used in traffic analysis.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-fg">Your travel routine</dt>
              <dd className="mt-0.5 leading-relaxed text-muted">
                Stored against your CityFlow ID so recommendations can be personalised. You
                can edit or remove it at any time from your profile.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-fg">City-level analysis</dt>
              <dd className="mt-0.5 leading-relaxed text-muted">
                Only aggregated totals — such as how many trips are expected in a time slot —
                are used for city planning. Individual travellers are not shown.
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/dashboard" size="lg">
            Continue to my dashboard
          </ButtonLink>
          <ButtonLink href="/how-it-works#privacy" variant="outline" size="lg">
            Read more about privacy
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
