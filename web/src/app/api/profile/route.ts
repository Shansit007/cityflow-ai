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

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[profile PUT] failed:", error);
    return NextResponse.json(
      { error: "We could not save your routine right now. Please try again." },
      { status: 500 }
    );
  }
}
