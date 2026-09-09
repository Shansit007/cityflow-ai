import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

/**
 * "Why congestion happens" — frames the problem CityFlow AI is built around.
 *
 * Every claim here is about how road demand works in general. Nothing on this
 * page states a measured result for a specific city, because we do not have one yet.
 */

const CAUSES = [
  {
    title: "Fixed schedules, shared timing",
    body: "Offices, colleges and schools start at similar times, so a large share of a city's trips begins inside the same short window.",
  },
  {
    title: "Roads have a capacity ceiling",
    body: "A road handles a certain number of vehicles smoothly. Past that point, small additions cause disproportionately large delays.",
  },
  {
    title: "Rerouting arrives too late",
    body: "Navigation apps react once congestion already exists. They can change the route, but the same vehicles are still on the network at the same moment.",
  },
  {
    title: "Moving the crowd is not solving it",
    body: "Shifting everyone to an alternative road — or to an earlier hour — simply relocates the peak instead of reducing it.",
  },
];

export function WhyCongestion() {
  return (
    <section className="py-20 sm:py-24">
      <Container width="wide">
        <SectionHeading
          eyebrow="The problem"
          title="Why congestion happens"
          description="A 15–20 minute journey often becomes an hour or more. Usually the cause is not the number of vehicles in a city — it is how many of them enter the road network at the same moment."
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {CAUSES.map((cause, index) => (
            <Card key={cause.title}>
              <div className="flex gap-4">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-sm font-semibold text-primary"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-base font-semibold text-fg">{cause.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{cause.body}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* The single sentence that separates CityFlow AI from a routing app. */}
        <div className="mt-8 rounded-card border-l-4 border-l-secondary border-y border-r border-border-base bg-secondary-soft/40 p-5 sm:p-6">
          <p className="text-base leading-relaxed text-fg">
            Existing systems ask{" "}
            <span className="font-semibold">“which road should this vehicle take?”</span>{" "}
            CityFlow AI asks{" "}
            <span className="font-semibold text-secondary">
              “how do we prevent too many vehicles from entering the network at the same
              time?”
            </span>
          </p>
        </div>
      </Container>
    </section>
  );
}
