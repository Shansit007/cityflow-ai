import { NextResponse } from "next/server";

import { getAdminOrNull } from "@/lib/auth/admin";
import { appDateOnly, appLocalDate } from "@/lib/app-time";
import { getCity, isCityCode } from "@/lib/cities";
import { reoptimiseCity } from "@/lib/demand/optimizer";

/**
 * POST /api/admin/reoptimise?city=<code>
 *
 * Runs the city-wide re-optimisation on demand, and reports what it did.
 *
 * WHY THIS EXISTS
 * The optimiser normally runs as a side effect of somebody confirming a travel
 * plan, which is correct for the product but awkward for evaluation: to test
 * it you had to remember to go and confirm something in the UI first, and if
 * you forgot, the two simulation scenarios came out identical with no
 * indication of why. That cost a full evening once.
 *
 * This route runs exactly the same function, under the admin guard, and returns
 * the summary — including the breakdown of why people did NOT move, which is
 * the part that makes a disappointing result diagnosable rather than mysterious.
 *
 * It changes recommendations, so it is a POST and it is admin-only. It never
 * touches a stored travel intention, and it never moves somebody who has
 * already committed — those rules live in the optimiser itself.
 */

export const runtime = "nodejs";

export async function POST(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const cityParam = searchParams.get("city") ?? "";
  const city = getCity(isCityCode(cityParam) ? cityParam : undefined);

  try {
    const startedAt = Date.now();
    const summary = await reoptimiseCity(city.code, appDateOnly(), appLocalDate());

    return NextResponse.json({
      city: city.code,
      cityName: city.name,
      tookMs: Date.now() - startedAt,
      ...summary,
    });
  } catch (error) {
    console.error("[admin reoptimise] failed:", error);
    return NextResponse.json(
      { error: "Re-optimisation failed. See the server log." },
      { status: 500 }
    );
  }
}
