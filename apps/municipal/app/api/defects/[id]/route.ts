import { NextResponse } from "next/server";

import { assign, setStatus } from "@/lib/defects";
import { DEFECT_STATUSES, TransitionRefused, type DefectStatus } from "@/lib/transitions";
import { readSession } from "@/lib/session";

const MAX_NOTE = 500;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const { id } = await params;
  const { assignee, status, note } = (body ?? {}) as Record<string, unknown>;

  try {
    if (assignee !== undefined) {
      if (assignee !== null && typeof assignee !== "string") {
        return NextResponse.json({ error: "Assign to whom?" }, { status: 400 });
      }
      await assign(session, id, assignee);
      return NextResponse.json({ id, assignee });
    }

    if (typeof status === "string") {
      if (!DEFECT_STATUSES.includes(status as DefectStatus)) {
        return NextResponse.json({ error: "No such status." }, { status: 400 });
      }
      if (note !== undefined && note !== null && typeof note !== "string") {
        return NextResponse.json({ error: "A note is text." }, { status: 400 });
      }
      if (typeof note === "string" && note.length > MAX_NOTE) {
        return NextResponse.json({ error: "That note is too long." }, { status: 400 });
      }

      await setStatus(session, id, status as DefectStatus, (note as string) ?? null);
      return NextResponse.json({ id, status });
    }

    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  } catch (error) {
    // Refusals are the expected answer to a stale queue or a role that may not do
    // this, not a server fault, and the message is written to be shown to staff.
    if (error instanceof TransitionRefused) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
