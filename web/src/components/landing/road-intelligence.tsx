import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

/**
 * Road condition intelligence.
 *
 * IMPORTANT BOUNDARY, STATED ON THE PAGE ITSELF
 * CityFlow AI detects *possible* road impacts and passes them on. The inspection,
 * repair and status update belong to the municipal system, which is a separate
 * existing service — not part of this application.
 */

const PIPELINE = [
  { step: "Smartphone sensors", detail: "Accelerometer and gyroscope readings while travelling" },
  { step: "Possible road impact", detail: "An unusual movement pattern is detected" },
  { step: "Location association", detail: "The impact is matched to a road segment" },
  { step: "Repeated detections", detail: "Several reports at the same place raise confidence" },
  { step: "Priority", detail: "A confidence and priority level is assigned" },
  { step: "Municipal system", detail: "Inspection, repair and status update happen there" },
];

export function RoadIntelligence() {
  return (
    <section
      id="road-conditions"
      className="border-y border-border-base bg-surface py-20 sm:py-24"
    >
      <Container width="wide">
        <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <SectionHeading
              eyebrow="Road condition intelligence"
              title="Rough roads slow a city down too"
              description="A journey is not only shaped by how many vehicles are on the road, but by the condition of the road itself. CityFlow AI can use ordinary smartphone motion sensors to flag places that may need attention."
            />

            <div className="mt-6 rounded-card border border-border-base bg-surface-2 p-5">
              <p className="text-sm font-semibold text-fg">What we do and do not claim</p>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
                <li>
                  Until it has been officially verified, a detection is shown as a{" "}
                  <span className="font-medium text-fg">“possible road issue”</span>.
                </li>
                <li>
                  Repeated detections at one location raise confidence — a single reading
                  never counts as proof.
                </li>
                <li>
                  Inspection and repair are handled by the existing municipal system, not by
                  CityFlow AI.
                </li>
              </ul>
            </div>
          </div>

          {/* Pipeline + a sample record, so the flow is concrete. */}
          <div>
            <ol className="space-y-2">
              {PIPELINE.map((item, index) => (
                <li
                  key={item.step}
                  className="flex items-start gap-4 rounded-lg border border-border-base bg-surface p-3.5"
                >
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-2 text-xs font-semibold text-muted"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-fg">{item.step}</p>
                    <p className="text-xs text-muted">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ol>

            <Card className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-subtle">
                Example record
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-fg">Sector 12 Main Road</p>
                  <p className="text-xs text-muted">340 detected impacts · possible road issue</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="high">Priority: High</Badge>
                  <Badge tone="neutral">Needs inspection</Badge>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </Container>
    </section>
  );
}
