import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { clearHistory, loadHistory } from "@/lib/chat/history-service";

/**
 * The assistant's conversation history.
 *
 *   GET    /api/chat/history  -> { messages }
 *   DELETE /api/chat/history  -> { deleted }
 *
 * Both are scoped to the signed-in user. Deleting is immediate and permanent —
 * the page promises the person can clear the conversation, and that promise has
 * to be real rather than a hidden "archived" flag.
 *
 * Clearing the transcript does NOT undo travel plans. Those are separate,
 * structured records; the page says so before it deletes anything.
 */

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const messages = await loadHistory(session.userId);
    return NextResponse.json({ messages });
  } catch (error) {
    console.error("[chat history GET] failed:", error);
    return NextResponse.json(
      { error: "Could not load your conversation." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const deleted = await clearHistory(session.userId);
    return NextResponse.json({ deleted });
  } catch (error) {
    console.error("[chat history DELETE] failed:", error);
    return NextResponse.json(
      { error: "Could not clear your conversation." },
      { status: 500 }
    );
  }
}
