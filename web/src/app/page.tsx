import { Benefits } from "@/components/landing/benefits";
import { ClosingCta } from "@/components/landing/cta";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { PrivacyAndExplainability } from "@/components/landing/privacy-explainability";
import { RoadIntelligence } from "@/components/landing/road-intelligence";
import { WhyCongestion } from "@/components/landing/why-congestion";

/**
 * Landing page.
 *
 * Reading order is deliberate:
 *   promise → problem → mechanism → who benefits → road conditions →
 *   privacy & explainability → invitation to sign up
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <WhyCongestion />
      <HowItWorks />
      <Benefits />
      <RoadIntelligence />
      <PrivacyAndExplainability />
      <ClosingCta />
    </>
  );
}
