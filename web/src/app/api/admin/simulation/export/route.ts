import { NextResponse } from "next/server";

import { getAdminOrNull } from "@/lib/auth/admin";
import {
  buildTrips,
  tripsToOdCsv,
  tripsToXml,
  zonesToTazTemplate,
  type SimulationScenario,
} from "@/lib/admin/sumo-export";
import { appDateKey } from "@/lib/app-time";
import { getCity, isCityCode } from "@/lib/cities";

/**
 * GET /api/admin/simulation/export?scenario=BASELINE|CITYFLOW&format=trips|taz|od&city=<code>
 *
 * Downloads today's demand in a form SUMO can read.
 *
 *   trips — a SUMO trip-definition file (.trips.xml), referencing zones by name
 *   taz   — the zone template (.add.xml) you fill in with network edge ids
 *   od    — a plain origin/destination CSV, for a custom pipeline
 *
 * The application does not run SUMO. It produces the input and stores the
 * results; the simulation itself happens on a workstation. See
 * docs/04-SUMO-EVALUATION.md for the exact commands.
 */

export const runtime = "nodejs";

export async function GET(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);

  const scenarioParam = (searchParams.get("scenario") ?? "").toUpperCase();
  if (scenarioParam !== "BASELINE" && scenarioParam !== "CITYFLOW") {
    return NextResponse.json(
      { error: "scenario must be BASELINE or CITYFLOW." },
      { status: 400 }
    );
  }
  const scenario = scenarioParam as SimulationScenario;

  const format = searchParams.get("format") ?? "trips";
  if (!["trips", "taz", "od"].includes(format)) {
    return NextResponse.json(
      { error: "format must be trips, taz or od." },
      { status: 400 }
    );
  }

  const cityParam = searchParams.get("city") ?? "";
  const city = getCity(isCityCode(cityParam) ? cityParam : undefined);

  try {
    const trips = await buildTrips(city.code, scenario);
    const dateKey = appDateKey();
    const stem = `cityflow-${city.code}-${dateKey}`;

    let body: string;
    let filename: string;
    let contentType: string;

    if (format === "taz") {
      body = zonesToTazTemplate(trips, city.code);
      filename = `${stem}-tazs.add.xml`;
      contentType = "application/xml; charset=utf-8";
    } else if (format === "od") {
      body = tripsToOdCsv(trips);
      filename = `${stem}-${scenario.toLowerCase()}.od.csv`;
      contentType = "text/csv; charset=utf-8";
    } else {
      body = tripsToXml(trips, scenario, city.code);
      filename = `${stem}-${scenario.toLowerCase()}.trips.xml`;
      contentType = "application/xml; charset=utf-8";
    }

    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        // Handy for the UI, which reports how many vehicles were exported.
        "X-CityFlow-Vehicles": String(trips.length),
      },
    });
  } catch (error) {
    console.error("[simulation export] failed:", error);
    return NextResponse.json(
      { error: "Could not build the export right now." },
      { status: 500 }
    );
  }
}
