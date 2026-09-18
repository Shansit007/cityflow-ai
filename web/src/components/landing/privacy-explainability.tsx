import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

/**
 * Privacy + explainability.
 *
 * These two are shown together on purpose: a system that asks people to change
 * their daily routine has to be both trustworthy with data and clear about its
 * reasoning. Either one alone is not enough.
 */

const PRIVACY_POINTS = [
  {
    title: "An anonymous CityFlow ID",
    body: "Your travel preferences and recommendations are linked to an ID such as CF-8X42K91 — not to your name.",
  },
  {
    title: "Email is for account access",
    body: "It is used for signing in, account recovery and important service messages. It is not part of traffic analysis.",
  },
  {
    title: "Cities see totals, not people",
    body: "The Admin Portal works with aggregated numbers such as “trips expected between 6:00 and 6:15 PM”, never individual travellers.",
  },
  {
    title: "You stay in control",
    body: "Your routine, preferences and privacy settings can be edited or removed from your profile at any time.",
  },
];

export function PrivacyAndExplainability() {
  return (
    <section className="py-20 sm:py-24">
      <Container width="wide">
        <div className="grid gap-10 lg:grid-cols-2">
          {/* ------------------------------------------------------ privacy */}
          <div id="privacy">
            <SectionHeading
              eyebrow="Privacy"
              title="Built to need as little about you as possible"
              description="CityFlow AI needs travel patterns to work. It does not need your identity attached to them."
            />

            <div className="mt-8 space-y-4">
              {PRIVACY_POINTS.map((point) => (
                <Card key={point.title}>
                  <h3 className="text-sm font-semibold text-fg">{point.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{point.body}</p>
                </Card>
              ))}
            </div>
          </div>

          {/* ----------------------------------------------- explainability */}
          <div id="explainability">
            <SectionHeading
              eyebrow="Explainable recommendations"
              title="Every suggestion says why"
              description="You should never have to trust a time you do not understand. Each recommendation shows the reasoning behind it in one sentence."
            />

            {/* A realistic worked example of the explanation panel. */}
            <Card raised className="mt-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-subtle">
                Why am I seeing this?
              </p>

              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-baseline justify-between gap-4 border-b border-border-base pb-3">
                  <dt className="text-muted">Your usual departure</dt>
                  <dd className="font-medium text-fg">9:00 AM</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 border-b border-border-base pb-3">
                  <dt className="text-muted">Expected demand then</dt>
                  <dd className="font-semibold text-traffic-high">Very high</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 border-b border-border-base pb-3">
                  <dt className="text-muted">Recommended departure</dt>
                  <dd className="font-semibold text-primary">8:45 AM</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted">Your required arrival</dt>
                  <dd className="font-medium text-fg">9:30 AM</dd>
                </div>
              </dl>

              <p className="mt-5 rounded-lg bg-surface-2 p-4 text-sm leading-relaxed text-fg">
                “Traffic demand is expected to be lower around 8:45 AM, while still keeping you
                within your preferred arrival window.”
              </p>

              <p className="mt-4 text-xs leading-relaxed text-subtle">
                Predictions are estimates. CityFlow AI does not promise an exact time saving,
                and you are always free to keep your usual departure time.
              </p>
            </Card>
          </div>
        </div>
      </Container>
    </section>
  );
}
