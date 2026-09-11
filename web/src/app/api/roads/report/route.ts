import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getCity } from "@/lib/cities";
import { rateLimit } from "@/lib/rate-limit";
import { submitRoadReport } from "@/lib/roads/road-service";
import { fieldErrorsFrom, roadReportSchema } from "@/lib/validation";

/**
 * POST /api/roads/report
 *
 * One deliberate road-issue report from a signed-in person.
 *
 * WHAT HAPPENS TO IT
 * The report is merged with any existing reports about the same kind of problem
 * in the same ~50 m cell, the issue's evidence and priority are recomputed, and
 * the person is told which of those three things happened. Nothing here decides
 * that a defect exists — see lib/roads/confidence.ts for why that distinction
 * is enforced in one place.
 */

export const runtime = "nodejs";

/** Twelve reports an hour is far more than any honest user needs. */
const REPORT_LIMIT = 12;
const REPORT_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in to report a road issue." }, { status: 401 });
  }

  const limit = rateLimit(`road-report:${user.id}`, REPORT_LIMIT, REPORT_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error:
          "You have sent a lot of reports in the last hour. Please try again a little later.",
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = roadReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Please check the highlighted fields.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      },
      { status: 400 }
    );
  }

  const input = parsed.data;

  /*
    The city comes from the signed-in user's own record, never from the request
    body. A client-supplied city would let anybody file reports against a city
    they have nothing to do with.
  */
  const city = getCity(user.cityCode ?? undefined);

  try {
    const outcome = await submitRoadReport(user.id, {
      cityCode: city.code,
      areaLabel: input.areaLabel,
      issueType: input.issueType,
      severity: input.severity,
      description: input.description || null,
      photo: input.photo || null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      source: "CITIZEN_REPORT",
    });

    return NextResponse.json({
      ok: true,
      ...outcome,
      message: MESSAGES[outcome.result],
    });
  } catch (error) {
    console.error("[roads/report] failed:", error);
    return NextResponse.json(
      { error: "We could not save that report right now. Please try again." },
      { status: 500 }
    );
  }
}

/** What the person is told, matched to what actually happened to their report. */
const MESSAGES = {
  created:
    "Thank you — you are the first person to report this. It will show as a possible road issue until others confirm it.",
  merged:
    "Thank you — your report has been added to existing reports about this place, which makes the evidence stronger.",
  "already-reported":
    "You have already reported this issue, so the count has not changed. It is still recorded.",
} as const;
