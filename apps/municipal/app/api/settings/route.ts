import { NextResponse } from "next/server";

import { setThreshold } from "@/lib/defects";
import { TransitionRefused } from "@/lib/transitions";
import { readSession } from "@/lib/session";

export async function PUT(request: Request): Promise<NextResponse> {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const { threshold } = (body ?? {}) as Record<string, unknown>;
  if (typeof threshold !== "number" || !Number.isFinite(threshold)) {
    return NextResponse.json({ error: "A threshold is a number." }, { status: 400 });
  }

  try {
    await setThreshold(session, threshold);
    return NextResponse.json({ threshold });
  } catch (error) {
    if (error instanceof TransitionRefused) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
