import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

/**
 * "How the numbers work" -- one place for the methodology notes that used to
 * be repeated, in full sentences, on the dashboard, journeys, participation,
 * roads and insights pages. Those pages now show a short label (or nothing)
 * plus a link here, instead of the same three sentences over and over.
 *
 * Nothing here is new information -- it is the same honesty disclosures the
 * app always made (demand is predicted not measured, time-saved figures are
 * arithmetic not a timed trip, roads are not individually coloured, mode
 * matching is not built yet). Consolidating them keeps every screen honest
 * without making every screen wordy.
 */

const TOPICS = [
  {
    title: "The demand index",
    body: "Every demand figure -- Low, Moderate, High, Very high, and the 0-100 number behind it -- is a model prediction, not a measurement. CityFlow AI does not have live sensors on the road; the index estimates how close a time slot is to comfortable road capacity, based on the same demand model the recommendation engine uses.",
  },
  {
    title: "Estimated time saved",
    body: "This figure is arithmetic on two predictions: the modelled journey time at your usual departure, and at the recommended one, using the normal (light-traffic) journey time you entered in your profile. CityFlow AI has never timed one of your actual journeys, so this is always a modelled estimate, never a measured saving.",
  },
  {
    title: "Why the map doesn't colour individual roads",
    body: "The shaded circle on the map shows predicted demand for the city as a whole. CityFlow AI does not yet have per-road traffic data, so colouring individual roads would suggest a level of detail the system does not actually have.",
  },
  {
    title: "Carpool & public-transport matching",
    body: "Registering interest in carpooling or public transport records your preference only. Matching people into shared trips is not built yet, so nothing is arranged on your behalf.",
  },
];

export function HowNumbersWork() {
  return (
    <section id="how-numbers-work" className="border-y border-border-base bg-surface py-20 sm:py-24">
      <Container width="wide">
        <SectionHeading
          eyebrow="How the numbers work"
          title="What every estimate on CityFlow AI actually means"
          description="The individual screens keep this short. If you want the full explanation behind a figure, it's here."
        />

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {TOPICS.map((topic) => (
            <Card key={topic.title}>
              <h3 className="text-sm font-semibold text-fg">{topic.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{topic.body}</p>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}
