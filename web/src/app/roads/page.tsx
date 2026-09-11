import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { CITY_COOKIE_NAME } from "@/components/city/city-provider";
import { RoadImpactDetector } from "@/components/roads/impact-detector";
import { RoadIssueList } from "@/components/roads/issue-list";
import { RoadReportForm } from "@/components/roads/report-form";
import { Card, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { getCurrentUser } from "@/lib/auth/session";
import { getCity } from "@/lib/cities";
import { prisma } from "@/lib/db";
import { loadIssuesForUser } from "@/lib/roads/road-service";

export const metadata: Metadata = {
  title: "Road conditions",
  description:
    "Report road problems near you and see what other people have reported on the roads you travel.",
};

/**
 * Road conditions — the citizen side of Phase 5.
 *
 * WHAT THIS PAGE IS
 * Somewhere a person can (a) see what has been reported on the roads they
 * actually use, (b) report something themselves, and (c) let their phone notice
 * rough stretches while they travel.
 *
 * WHAT THIS PAGE IS NOT
 * It is not a municipal work-tracking screen. There is no inspection status, no
 * repair date, no crew, no "resolved" button — because CityFlow AI does not do
 * any of those things and does not know when they happen. The Municipal
 * Dashboard, a separate existing system, owns that workflow. The only status
 * shown here is whether a report has been passed on, which is the one fact this
 * system actually knows.
 */
export default async function RoadsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/roads");

  const profile = await prisma.travelProfile.findUnique({
    where: { userId: user.id },
    select: { homeArea: true, destinationArea: true },
  });

  // Without a routine there is no home or destination area, so there is nothing
  // to scope the list to. Onboarding is one screen away.
  if (!profile) redirect("/onboarding");

  const cookieStore = await cookies();
  const city = getCity(cookieStore.get(CITY_COOKIE_NAME)?.value ?? user.cityCode);

  const issues = await loadIssuesForUser({
    userId: user.id,
    cityCode: city.code,
    homeArea: profile.homeArea,
    destinationArea: profile.destinationArea,
  });

  return (
    <section className="py-8 sm:py-12">
      <Container width="wide">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            Road conditions
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Problems reported on the roads between{" "}
            <span className="font-medium text-fg">{profile.homeArea}</span> and{" "}
            <span className="font-medium text-fg">{profile.destinationArea}</span> in{" "}
            {city.name}.
          </p>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-3">
            <RoadIssueList issues={issues} emptyArea={profile.homeArea} />
            <RoadReportForm
              defaultArea={profile.homeArea}
              destinationArea={profile.destinationArea}
            />
          </div>

          <div className="space-y-6 lg:col-span-2">
            <RoadImpactDetector areaLabel={profile.homeArea} />

            <Card>
              <CardHeader title="Who does what" />
              <ol className="space-y-4 text-sm leading-relaxed text-muted">
                <HandoffStep
                  step="1"
                  title="You report, or your phone notices"
                  body="A report from a person carries more weight than a jolt a sensor felt, because a person has actually looked at it."
                />
                <HandoffStep
                  step="2"
                  title="CityFlow AI merges and weighs"
                  body="Reports about the same spot are combined. More independent reports mean higher confidence — one report is only ever a possibility."
                />
                <HandoffStep
                  step="3"
                  title="CityFlow AI prioritises"
                  body="Issues are ranked by evidence, reported severity, and how many trips pass through that area — the one thing a traffic system knows that a complaints inbox does not."
                />
                <HandoffStep
                  step="4"
                  title="The municipal team inspects and repairs"
                  body="The prioritised list is handed to the municipal road-maintenance system. Inspection, repair and progress tracking all happen there, not here."
                />
              </ol>

              <p className="mt-5 border-t border-border-base pt-4 text-xs leading-relaxed text-subtle">
                CityFlow AI cannot tell you when something will be fixed, because it is not
                told. Saying otherwise would be a guess dressed up as a commitment.
              </p>
            </Card>
          </div>
        </div>
      </Container>
    </section>
  );
}

function HandoffStep({ step, title, body }: { step: string; title: string; body: string }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary"
      >
        {step}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-fg">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">{body}</span>
      </span>
    </li>
  );
}
