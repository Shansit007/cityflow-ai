import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { getCurrentUser } from "@/lib/auth/session";
import { getCity } from "@/lib/cities";

export const metadata: Metadata = {
  title: "My dashboard",
};

/**
 * Commuter dashboard — PHASE 1 VERSION.
 *
 * At this stage the dashboard only confirms that authentication, the anonymous
 * ID and the city context all work end to end. The real content — today's
 * recommendation, the upcoming-peak strip, the map and the routine editor — is
 * built in Phase 2.
 *
 * It deliberately shows placeholders labelled as such rather than invented
 * traffic numbers, because showing fake data here would make the product look
 * like it works when it does not yet.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const city = getCity(user.cityCode);
  const greetingName = user.displayName ?? "there";

  const upcomingSections = [
    {
      title: "Today's travel recommendation",
      body: "A recommended departure time, your usual time, the reason behind the suggestion, and buttons to accept or change your plan.",
    },
    {
      title: "Traffic status and upcoming peak",
      body: "Current status for your area, and how demand is expected to build across the next few 15-minute slots.",
    },
    {
      title: "My routine",
      body: "Your home and work or college location, usual departure, required arrival, and how flexible you are.",
    },
    {
      title: "Map experience",
      body: "Traffic visualisation, incident markers and road-condition markers on an OpenStreetMap base layer.",
    },
    {
      title: "Road conditions near you",
      body: "Possible road issues reported near your regular route, with confidence and status.",
    },
    {
      title: "Recommendation history",
      body: "What was recommended, what you chose, and the outcome where it is available.",
    },
  ];

  return (
    <section className="py-10 sm:py-14">
      <Container width="wide">
        {/* ------------------------------------------------------- header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              Hello, {greetingName}
            </h1>
            <p className="mt-2 text-sm text-muted">
              CityFlow ID:{" "}
              <span className="font-mono font-medium text-fg">{user.cityflowId}</span>
              <span className="mx-2 text-border-strong" aria-hidden="true">
                ·
              </span>
              Viewing <span className="font-medium text-fg">{city.name}</span>
            </p>
          </div>

          <Badge tone="primary">Phase 1 · foundation ready</Badge>
        </div>

        {/* ------------------------------------------- honest status notice */}
        <Card raised className="mt-8">
          <CardHeader
            title="Your account is set up"
            description="Authentication, your anonymous CityFlow ID and city context are working."
          />

          <p className="text-sm leading-relaxed text-muted">
            The next step is telling CityFlow AI about your regular travel routine — where you
            usually travel, when you normally leave, when you need to arrive and how flexible
            that is. That onboarding flow, together with the real dashboard, is built in the
            next phase of development.
          </p>

          <p className="mt-4 rounded-lg bg-surface-2 p-4 text-sm leading-relaxed text-fg">
            Nothing on this page is invented traffic data. Real recommendations appear once
            the demand prediction and optimisation services are connected.
          </p>
        </Card>

        {/* --------------------------------------------- what comes next */}
        <h2 className="mt-12 text-lg font-semibold text-fg">Coming to this dashboard</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {upcomingSections.map((section) => (
            <Card key={section.title}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-fg">{section.title}</h3>
                <Badge tone="neutral">Phase 2</Badge>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{section.body}</p>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}
