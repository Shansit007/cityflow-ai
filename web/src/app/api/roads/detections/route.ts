import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getCity } from "@/lib/cities";
import { toZoneKey } from "@/lib/demand/zones";
import { rateLimit } from "@/lib/rate-limit";
import { cellKeyFor } from "@/lib/roads/cell";
import { submitRoadReport } from "@/lib/roads/road-service";
import { fieldErrorsFrom, roadDetectionBatchSchema } from "@/lib/validation";

/**
 * POST /api/roads/detections
 *
 * A batch of road impacts detected by a phone's motion sensors during one trip.
 *
 * ==================== WHY THIS IS TREATED AS WEAK EVIDENCE ===================
 * An accelerometer cannot tell a pothole from a speed breaker, a kerb, a
 * railway crossing, or the phone sliding off the passenger seat. Everything
 * this endpoint records is therefore filed as a POSSIBLE issue from a SENSOR
 * source, and lib/roads/confidence.ts counts it as half the evidence of a
 * person who stopped and filled in a form.
 *
 * A detection with no location is rejected outright by the schema — a bump
 * with no idea where it happened is not information.
 *
 * The severity is always recorded as MEDIUM. The magnitude of a jolt says as
 * much about the vehicle's suspension and the phone's mounting as it does about
 * the road, so deriving "dangerous" from it would be a fabricated measurement.
 * The raw magnitude is stored so that a threshold can be tuned against real
 * data later rather than guessed at twice.
 * ============================================================================
 */

export const runtime = "nodejs";

/** A trip's batch, a few times an hour, is plenty. */
const BATCH_LIMIT = 6;
const BATCH_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const limit = rateLimit(`road-detections:${user.id}`, BATCH_LIMIT, BATCH_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many detection batches in the last hour." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = roadDetectionBatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "That batch could not be read.", fieldErrors: fieldErrorsFrom(parsed.error) },
      { status: 400 }
    );
  }

  const city = getCity(user.cityCode ?? undefined);

  /*
    Collapse detections that fall in the same ~50 m cell before touching the
    database. A rough hundred-metre stretch of road produces several jolts that
    all merge into one issue anyway, so sending each one separately would do the
    same work repeatedly. Keeping the strongest reading per cell is the useful
    part, since that is the number stored for later threshold tuning.

    This also bounds the work: each submission recomputes the issue's evidence
    and priority, which costs a few queries, and thirty of those in sequence
    would be slow enough to matter on a serverless function's time limit.
  */
  const strongestPerCell = new Map<string, (typeof parsed.data.detections)[number]>();
  for (const detection of parsed.data.detections) {
    const key = cellKeyFor({
      cityCode: city.code,
      zoneKey: toZoneKey(detection.areaLabel),
      lat: detection.lat,
      lng: detection.lng,
    });

    const existing = strongestPerCell.get(key);
    if (!existing || detection.magnitude > existing.magnitude) {
      strongestPerCell.set(key, detection);
    }
  }

  let recorded = 0;
  let alreadyKnown = 0;

  try {
    for (const detection of strongestPerCell.values()) {
      const outcome = await submitRoadReport(user.id, {
        cityCode: city.code,
        areaLabel: detection.areaLabel,
        issueType: "BROKEN_SURFACE",
        // See the header: magnitude is not a severity measurement.
        severity: "MEDIUM",
        description: null,
        photo: null,
        lat: detection.lat,
        lng: detection.lng,
        source: "SENSOR_DETECTION",
        impactMagnitude: detection.magnitude,
      });

      if (outcome.result === "already-reported") alreadyKnown += 1;
      else recorded += 1;
    }

    return NextResponse.json({
      ok: true,
      recorded,
      alreadyKnown,
      message:
        recorded > 0
          ? `${recorded} possible road impact${recorded === 1 ? "" : "s"} recorded. These are hints, not confirmed problems.`
          : "Those places were already recorded from your earlier trips.",
    });
  } catch (error) {
    console.error("[roads/detections] failed:", error);
    return NextResponse.json(
      { error: "We could not save those detections right now." },
      { status: 500 }
    );
  }
}
