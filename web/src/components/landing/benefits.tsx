import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

/**
 * Benefits, split by audience: citizens and cities.
 *
 * Written carefully in conditional language ("may", "helps"), because CityFlow AI
 * has not yet measured outcomes on a real road network. Overstating results would
 * undermine the trust the rest of the product is trying to build.
 */

const CITIZEN_BENEFITS = [
  {
    title: "A clear answer to “when should I leave?”",
    body: "One recommended departure time each day, based on your own routine and required arrival time.",
  },
  {
    title: "Less time spent inside a jam",
    body: "Leaving before a predicted peak may help you avoid the worst of it, instead of joining it and rerouting later.",
  },
  {
    title: "Plans you can change",
    body: "Tell the assistant your plan changed. Recommendations adjust — nothing is forced on you.",
  },
  {
    title: "Reasons, not black boxes",
    body: "Every recommendation comes with a short explanation of why that time was suggested.",
  },
];

const CITY_BENEFITS = [
  {
    title: "Prevention instead of reaction",
    body: "Acting on predicted demand before congestion forms, rather than managing it after it appears.",
  },
  {
    title: "Flatter peaks",
    body: "Spreading flexible trips across nearby slots reduces how far demand overshoots road capacity.",
  },
  {
    title: "Aggregated, anonymised insight",
    body: "Zone and time-slot level demand for planning, without exposing individual travellers.",
  },
  {
    title: "Evidence before deployment",
    body: "Simulation compares a normal day against a CityFlow AI day, so changes can be evaluated first.",
  },
];

export function Benefits() {
  return (
    <section className="py-20 sm:py-24">
      <Container width="wide">
        <SectionHeading
          eyebrow="Benefits"
          title="Useful for the person travelling, useful for the city"
          description="The same mechanism serves both: a commuter wants a smoother trip, a city wants a flatter peak. Demand smoothing is where those two interests meet."
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <BenefitColumn
            heading="For citizens"
            accentClassName="bg-primary-soft text-primary"
            items={CITIZEN_BENEFITS}
          />
          <BenefitColumn
            heading="For cities"
            accentClassName="bg-secondary-soft text-secondary"
            items={CITY_BENEFITS}
          />
        </div>
      </Container>
    </section>
  );
}

function BenefitColumn({
  heading,
  accentClassName,
  items,
}: {
  heading: string;
  accentClassName: string;
  items: Array<{ title: string; body: string }>;
}) {
  return (
    <Card>
      <span
        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${accentClassName}`}
      >
        {heading}
      </span>

      <ul className="mt-5 space-y-5">
        {items.map((item) => (
          <li key={item.title} className="border-t border-border-base pt-5 first:border-0 first:pt-0">
            <h3 className="text-sm font-semibold text-fg">{item.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.body}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
