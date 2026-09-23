import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { isCityCode } from "@/lib/cities";
import { prisma } from "@/lib/db";
import { fieldErrorsFrom, travelProfileSchema } from "@/lib/validation";

/**
 * The signed-in user's travel routine.
 *
 *   GET  /api/profile   -> { profile }        (profile is null before onboarding)
 *   PUT  /api/profile   -> { profile }        creates it, or updates it in place
 *
 * The SAME endpoint serves onboarding and later edits. One code path means the
 * two can never validate differently or store different shapes.
 */

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const profile = await prisma.travelProfile.findUnique({
      where: { userId: session.userId },
    });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[profile GET] failed:", error);
    return NextResponse.json({ error: "Could not load your routine." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // The city travels alongside the profile but lives on the user record.
  const cityCode =
    typeof (body as { cityCode?: unknown })?.cityCode === "string"
      ? (body as { cityCode: string }).cityCode.toLowerCase()
      : null;

  const parsed = travelProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Please check the highlighted fields.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // If the person is not flexible at all, a flexibility window is meaningless.
  // Normalising here means the engine never has to second-guess the stored data.
  const flexibilityMinutes = data.isFlexible ? data.flexibilityMinutes : 0;

  try {
    const profile = await prisma.travelProfile.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        homeArea: data.homeArea,
        destinationArea: data.destinationArea,
        destinationType: data.destinationType,
        primaryMode: data.primaryMode,
        usualDeparture: data.usualDeparture,
        requiredArrival: data.requiredArrival,
        typicalJourneyMinutes: data.typicalJourneyMinutes,
        travelDays: data.travelDays,
        isFlexible: data.isFlexible,
        flexibilityMinutes,
        preferredModes: data.preferredModes,
        maxAcceptableDelayMinutes: data.maxAcceptableDelayMinutes,
        willingToLeaveEarlier: data.willingToLeaveEarlier,
        willingToLeaveLater: data.willingToLeaveLater,
        carpoolInterest: data.carpoolInterest,
        publicTransportInterest: data.publicTransportInterest,
        shareAggregatedDemand: data.shareAggregatedDemand,
        allowNotifications: data.allowNotifications,
      },
      update: {
        homeArea: data.homeArea,
        destinationArea: data.destinationArea,
        destinationType: data.destinationType,
        primaryMode: data.primaryMode,
        usualDeparture: data.usualDeparture,
        requiredArrival: data.requiredArrival,
        typicalJourneyMinutes: data.typicalJourneyMinutes,
        travelDays: data.travelDays,
        isFlexible: data.isFlexible,
        flexibilityMinutes,
        preferredModes: data.preferredModes,
        maxAcceptableDelayMinutes: data.maxAcceptableDelayMinutes,
        willingToLeaveEarlier: data.willingToLeaveEarlier,
        willingToLeaveLater: data.willingToLeaveLater,
        carpoolInterest: data.carpoolInterest,
        publicTransportInterest: data.publicTransportInterest,
        shareAggregatedDemand: data.shareAggregatedDemand,
        allowNotifications: data.allowNotifications,
      },
    });

    // Finishing this form is what marks onboarding as done.
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        onboardingCompleted: true,
        ...(cityCode && isCityCode(cityCode) ? { cityCode } : {}),
      },
    });

    /*
      SYNC INTO THE ACTIVE ROUTINE.

      `TravelProfile` used to be the only record of a person's trip. Since
      Phase 6 the real, per-routine data the dashboard actually reads lives on
      `Journey` rows instead (see journey-service.ts), and `TravelProfile`'s
      overlapping fields — home/destination area, schedule, flexibility, mode
      — are read only ONCE, lazily, to create someone's first journey
      (`ensureJourneys`). After that they are two disconnected records: this
      page's own copy promises "change any of it, any time," but saving here
      used to silently write to a record nothing else ever reads again, while
      the dashboard kept showing whatever the Journey row still said.

      Fixed for the one case that is unambiguous: a person with exactly one
      routine has only one possible journey this page could mean, so the edit
      is mirrored onto it. With zero routines there is nothing to update yet
      (the next dashboard load creates the first journey from this same
      profile data). With two or more, guessing which one to overwrite would
      risk silently corrupting a routine the person did not mean to touch, so
      nothing is written — ProfileForm tells the person to use "My journeys"
      instead.
    */
    const journeys = await prisma.journey.findMany({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (journeys.length === 1) {
      await prisma.journey.update({
        where: { id: journeys[0].id },
        data: {
          originArea: data.homeArea,
          destinationArea: data.destinationArea,
          destinationType: data.destinationType,
          mode: data.primaryMode,
          usualDeparture: data.usualDeparture,
          requiredArrival: data.requiredArrival,
          typicalJourneyMinutes: data.typicalJourneyMinutes,
          travelDays: data.travelDays,
          isFlexible: data.isFlexible,
          flexibilityMinutes,
          willingToLeaveEarlier: data.willingToLeaveEarlier,
          willingToLeaveLater: data.willingToLeaveLater,
        },
      });
    }

    return NextResponse.json({ profile, journeyCount: journeys.length });
  } catch (error) {
    console.error("[profile PUT] failed:", error);
    return NextResponse.json(
      { error: "We could not save your routine right now. Please try again." },
      { status: 500 }
    );
  }
}
