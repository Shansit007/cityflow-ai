import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

/**
 * "How CityFlow AI works" — the five-step pipeline, in plain language.
 *
 * Rendered as an ordered list so the sequence is obvious to screen readers too,
 * not only visually through the connecting line.
 */

const STEPS = [
  {
    title: "Understand your routine",
    body: "You tell CityFlow AI where you usually travel, when you normally leave, when you need to arrive, and how flexible that is.",
  },
  {
    title: "Predict demand, not just traffic",
    body: "The system estimates how many trips are expected in each zone and each time slot — before those trips start.",
  },
  {
    title: "Find the expected peaks",
    body: "Time slots where predicted demand is close to or above what the road network handles comfortably are flagged as peaks.",
  },
  {
    title: "Distribute trips across nearby slots",
    body: "An optimiser spreads flexible trips into neighbouring time slots, while respecting each person's required arrival time.",
  },
  {
    title: "Recommend, and explain",
    body: "You get a suggested departure time and the reason behind it. You decide whether to use it — and can change your plan any time.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-y border-border-base bg-surface py-20 sm:py-24">
      <Container width="wide">
        <SectionHeading
          eyebrow="How it works"
          title="Predict demand. Understand flexibility. Distribute trips."
          description="The goal is demand smoothing — reducing how sharp the peak is — not moving congestion from one road or hour to another."
        />

        <ol className="mt-12 grid gap-8 lg:grid-cols-5">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative">
              {/* Connector line between steps on large screens. */}
              {index < STEPS.length - 1 && (
                <span
                  className="absolute left-[calc(1.25rem+1px)] top-10 hidden h-[calc(100%-2.5rem)] w-px bg-border-base lg:left-0 lg:top-[1.15rem] lg:h-px lg:w-full"
                  aria-hidden="true"
                />
              )}

              <div className="relative flex gap-4 lg:block">
                <span
                  className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-surface text-sm font-semibold text-primary"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>

                <div className="lg:mt-5">
                  <h3 className="text-base font-semibold text-fg">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>

        {/* The self-check that makes this different from "everyone leave earlier". */}
        <div
          id="demand-smoothing"
          className="mt-12 rounded-card border border-border-base bg-surface-2 p-6 sm:p-8"
        >
          <h3 className="text-lg font-semibold text-fg">
            What if everyone shifts to the same new time?
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
            That is exactly the failure CityFlow AI is designed to avoid. Confirmed changes
            feed back into the city-level demand picture, demand is recalculated, and the new
            time slot is checked in turn. If 6:00 PM is about to become the new peak, the
            optimiser spreads trips across 5:45, 6:00 and 6:15 instead of sending everyone to
            the same moment.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              { label: "Confirmed changes", body: "Only travel plans you confirm are counted." },
              { label: "Aggregated by zone and slot", body: "Individual trips become city-level demand." },
              { label: "Re-optimised", body: "Recommendations update if the picture changes." },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-border-base bg-surface p-4">
                <p className="text-sm font-semibold text-fg">{item.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
