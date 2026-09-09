import { NextResponse } from "next/server";

import { endSession } from "@/lib/auth/session";

/**
 * POST /api/auth/logout
 *
 * Clears the session cookie. Always succeeds, even if nobody was logged in,
 * so the UI can call it without worrying about the current state.
 */

export const runtime = "nodejs";

export async function POST() {
  await endSession();
  return NextResponse.json({ ok: true });
}
