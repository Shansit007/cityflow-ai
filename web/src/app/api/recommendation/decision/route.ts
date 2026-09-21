import { NextResponse } from "next/server";

import { appDateOnly } from "@/lib/app-time";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getOwnedJourney } from "@/lib/journeys/journey-service";
import { fieldErrorsFrom, recommendationDecisionSchema } from "@/lib/validation";

/**
 * POST /api/recommendation/decision
 *
 * Records what the person decided about one routine's recommendation today:
 *   ACCEPTED   — they will use the recommended time
 *   KEPT_USUAL — they will stick with their normal time
 *   CUSTOM     — they chose some other time (sent as `chosenDeparture`)
 *
 * WHY THIS MATTERS BEYOND THE UI
 * A recommendation nobody acts on tells the system nothing. These confirmed
 * decisions are what feed aggregated city demand — which is how CityFlow AI
 * notices that a suggested slot is filling up and re-spreads people instead of
 * creating a new peak.
 *
 * Nothing is recorded unless the person actually presses a button. The system
 * never assumes a decision on their behalf.
 */

export const runtime = "nodejs";

export async function POST(request: Request) {
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

  const parsed = recommendationDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Please check your selection.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      },
      { status: 400 }
    );
  }

  const { journeyId, decision, chosenDeparture } = parsed.data;

  if (decision === "CUSTOM" && !chosenDeparture) {
    return NextResponse.json(
      { error: "Please provide the departure time you have chosen." },
      { status: 400 }
    );
  }

  try {
    // Ownership is checked before anything else. `getOwnedJourney` returns null
    // for both "not yours" and "does not exist", so a probe cannot learn which.
    const journey = await getOwnedJourney(session.userId, journeyId);
    if (!journey) {
      return NextResponse.json({ error: "That journey was not found." }, { status: 404 });
    }

    const travelDate = appDateOnly();

    const existing = await prisma.recommendation.findUnique({
      where: { journeyId_travelDate: { journeyId, travelDate } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "There is no recommendation for this journey today yet." },
        { status: 404 }
      );
    }

    // Work out which departure time the decision actually means.
    const resolvedDeparture =
      decision === "ACCEPTED"
        ? existing.recommendedDeparture
        : decision === "KEPT_USUAL"
          ? existing.usualDeparture
          : chosenDeparture!;

    const updated = await prisma.recommendation.update({
      where: { id: existing.id },
      data: {
        status: decision,
        chosenDeparture: resolvedDeparture,
        // An explicit choice answers any outstanding "we changed this for you"
        // notice, so it stops being shown.
        updateAcknowledged: true,
      },
    });

    return NextResponse.json({ recommendation: updated });
  } catch (error) {
    console.error("[recommendation decision] failed:", error);
    return NextResponse.json(
      { error: "We could not save your choice right now. Please try again." },
      { status: 500 }
    );
  }
}
