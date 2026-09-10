import { NextResponse } from "next/server";

import { appDateOnly } from "@/lib/app-time";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

/**
 * POST /api/recommendation/acknowledge
 *
 * Marks today's "your recommendation changed" notice as seen.
 *
 * The notice is not dismissed automatically on page load: a person who opens
 * the dashboard on their phone in their pocket has not read anything. It stays
 * until they actually press the button.
 */

export const runtime = "nodejs";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    await prisma.recommendation.updateMany({
      where: { userId: session.userId, travelDate: appDateOnly() },
      data: { updateAcknowledged: true },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[acknowledge] failed:", error);
    return NextResponse.json({ error: "Could not update the notice." }, { status: 500 });
  }
}
