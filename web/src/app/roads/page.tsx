import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CITY_COOKIE_NAME } from "@/components/city/city-provider";
import { RoadImpactDetector } from "@/components/roads/impact-detector";
import { RoadIssueList } from "@/components/roads/issue-list";
import { RoadReportForm } from "@/components/roads/report-form";
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

            <p className="text-center text-xs text-subtle">
              What happens after you report ·{" "}
              <Link
                href="/how-it-works#road-conditions"
                className="underline underline-offset-2"
              >
                how this works
              </Link>
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
