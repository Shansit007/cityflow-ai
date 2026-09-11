import { NextResponse } from "next/server";

import { getAdminOrNull } from "@/lib/auth/admin";
import { appDateKey } from "@/lib/app-time";
import { getCity, isCityCode } from "@/lib/cities";
import { buildHandoffPayload, markHandedOver } from "@/lib/roads/road-service";

/**
 * GET /api/admin/roads/handoff?city=<code>
 *
 * Produces the file the **existing** Municipal Dashboard consumes.
 *
 * ======================== WHY A FILE AND NOT AN API CALL ====================
 * The Municipal Dashboard is a separate system that CityFlow AI does not own,
 * cannot deploy to, and has no credentials for. Writing code that POSTs into it
 * would be inventing an integration contract on somebody else's behalf, and it
 * would fail the moment their system differs from the guess.
 *
 * A downloadable, self-describing JSON file is the honest interface: it works
 * today by hand, it documents exactly what each field means, and when a real
 * endpoint exists, one fetch call replaces the download and the payload stays
 * identical. See docs/06-MUNICIPAL-HANDOFF.md.
 * ============================================================================
 *
 * SIDE EFFECT: every issue included is stamped `handedOverAt`. That records one
 * fact only — "this appeared in a file we gave them". It is not a repair status
 * and is never shown as one.
 *
 * PRIVACY: the payload contains places, categories, counts and a score. No user
 * id, no CityFlow ID, no email, and no reporter of any kind.
 */

export const runtime = "nodejs";

export async function GET(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const cityParam = searchParams.get("city") ?? "";
  const city = getCity(isCityCode(cityParam) ? cityParam : undefined);

  /*
    `preview=1` lets an operator look at what would be sent without stamping
    anything as handed over — useful before a first real hand-off.
  */
  const preview = searchParams.get("preview") === "1";

  try {
    const { payload, issueIds } = await buildHandoffPayload(city.code, city.name);

    /*
      Stamp exactly the rows that made it into this file — `issueIds` comes from
      the same query that built the payload, so a report arriving mid-request
      cannot be marked as handed over without appearing in it.
    */
    if (!preview && issueIds.length > 0) {
      await markHandedOver(city.code, issueIds);
    }

    const filename = `cityflow-road-handoff-${city.code}-${appDateKey()}.json`;

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[admin roads handoff] failed:", error);
    return NextResponse.json(
      { error: "Could not build the hand-off file right now." },
      { status: 500 }
    );
  }
}
