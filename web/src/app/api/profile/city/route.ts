import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { isCityCode } from "@/lib/cities";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/profile/city
 *
 * Persists the active city to the signed-in user's account.
 *
 * WHY THIS EXISTS
 * The city shown in the app has always lived in a cookie (fast, no database
 * round trip, read by the dashboard/insights/roads pages) but Saarthi and the
 * trip planner read `User.cityCode` from the database instead, so changing
 * the cookie alone left those two silently out of sync with everything else.
 * This route is the one place that updates the database column, called
 * whenever the active city changes — from the travel-plan form or from a
 * geolocation detection — so both stay in step. See `CityProvider.setCityCode`.
 */

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const limit = rateLimit(`profile-city:${session.userId}`, 30, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const cityCode =
    typeof body === "object" && body !== null && "cityCode" in body
      ? String((body as { cityCode: unknown }).cityCode)
      : "";

  if (!isCityCode(cityCode)) {
    return NextResponse.json({ error: "Unknown city." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { cityCode },
  });

  return NextResponse.json({ ok: true, cityCode });
}
