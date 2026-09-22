import type { Metadata } from "next";

import { HowItWorks } from "@/components/landing/how-it-works";
import { HowNumbersWork } from "@/components/landing/how-numbers-work";
import { PrivacyAndExplainability } from "@/components/landing/privacy-explainability";
import { RoadIntelligence } from "@/components/landing/road-intelligence";
import { WhyCongestion } from "@/components/landing/why-congestion";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "How CityFlow AI works",
  description:
    "How CityFlow AI predicts travel demand, understands flexibility and distributes trips across nearby time slots to reduce peak overload.",
};

/**
 * "How it works" page.
 *
 * Reuses the same sections as the landing page rather than duplicating the
 * explanations — one source of truth for how the product describes itself.
 */
export default function HowItWorksPage() {
  return (
    <>
      <section className="border-b border-border-base bg-surface py-16 sm:py-20">
        <Container width="wide">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
            Understanding CityFlow AI
          </p>

          <h1 className="max-w-3xl text-balance text-3xl font-semibold leading-tight text-fg sm:text-4xl">
            From reacting to congestion, to preventing it
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            CityFlow AI works on one idea: a road network struggles when too many trips start
            at the same moment. If some of those trips can start slightly earlier or later,
            the peak becomes less sharp for everyone.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/signup" size="lg">
              Get Started
            </ButtonLink>
            <ButtonLink href="/" variant="outline" size="lg">
              Back to home
            </ButtonLink>
          </div>
        </Container>
      </section>

      <WhyCongestion />
      <HowItWorks />
      <RoadIntelligence />
      <HowNumbersWork />
      <PrivacyAndExplainability />
    </>
  );
}
