import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";

/**
 * GET /api/auth/me
 *
 * Returns the currently signed-in user, or 401 when nobody is signed in.
 * Used by client components that need to know who is looking at the page.
 *
 * The password hash is never part of the response.
 */

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("[me] failed:", error);
    return NextResponse.json({ error: "Could not load your account." }, { status: 500 });
  }
}
