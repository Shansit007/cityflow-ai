import { NextResponse } from "next/server";

import { getAdminOrNull } from "@/lib/auth/admin";
import { appDateOnly } from "@/lib/app-time";
import { isCityCode } from "@/lib/cities";
import { prisma } from "@/lib/db";
import { fieldErrorsFrom, simulationRunSchema } from "@/lib/validation";

/**
 * POST /api/admin/simulation/run
 *
 * Records the metrics from a completed SUMO run.
 *
 * WHY THIS IS AN INPUT AND NOT A JOB TRIGGER
 * SUMO is a desktop simulator. A serverless function cannot host it, and a
 * button labelled "Run simulation" that quietly fabricated numbers would be the
 * single most dishonest thing this project could ship. So the loop is explicit:
 * export demand from here, run it on a workstation, bring the results back.
 *
 * Every row created here came from a real run that a person carried out.
 */

export const runtime = "nodejs";

export async function POST(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = simulationRunSchema.safeParse(body);
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

  if (!isCityCode(data.cityCode)) {
    return NextResponse.json({ error: "Unknown city." }, { status: 400 });
  }

  try {
    const run = await prisma.simulationRun.create({
      data: {
        cityCode: data.cityCode.toLowerCase(),
        travelDate: appDateOnly(),
        scenario: data.scenario,
        networkSource: data.networkSource,
        vehiclesDeparted: data.vehiclesDeparted,
        meanTravelTimeSeconds: data.meanTravelTimeSeconds,
        totalDelaySeconds: data.totalDelaySeconds,
        peakSlotVehicles: data.peakSlotVehicles,
        meanWaitingSeconds: data.meanWaitingSeconds,
        notes: data.notes && data.notes.length > 0 ? data.notes : null,
      },
    });

    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    console.error("[simulation run] failed:", error);
    return NextResponse.json(
      { error: "Could not save that run right now." },
      { status: 500 }
    );
  }
}
