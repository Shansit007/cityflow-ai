import { NextResponse } from "next/server";

import { appDateOnly, appLocalDate } from "@/lib/app-time";
import { getSession } from "@/lib/auth/session";
import { buildAssistantReply } from "@/lib/chat/assistant";
import {
  recordAssistantMessage,
  recordUserMessage,
} from "@/lib/chat/history-service";
import { parseIntent } from "@/lib/chat/intent-parser";
import { getCity } from "@/lib/cities";
import { prisma } from "@/lib/db";
import { demandAtFor, loadDemandContext } from "@/lib/demand/aggregate";
import { chatMessageSchema, fieldErrorsFrom } from "@/lib/validation";

/**
 * POST /api/chat
 *
 * Reads one sentence and replies. **This endpoint never writes TRAVEL data.**
 *
 * That separation is the whole safety model of the assistant: understanding a
 * sentence and acting on it are two different HTTP calls. This one interprets
 * and proposes; `/api/intent/confirm` is the only place a plan is stored, and
 * it is only ever reached by the person pressing a button.
 *
 * It does store the conversation, so the person can scroll back through it on
 * their next visit. That transcript is a record, never an input: nothing in the
 * demand or recommendation pipeline reads it. The only thing the system acts on
 * is the structured intention the person explicitly confirms.
 */

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = chatMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check your message.", fieldErrors: fieldErrorsFrom(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const profile = await prisma.travelProfile.findUnique({
      where: { userId: session.userId },
    });

    if (!profile) {
      const text =
        "Before I can help with your travel plan, I need to know your regular routine. You can set it up from the “Set up my travel routine” page — it takes about a minute.";

      const [userMessage, assistantMessage] = [
        await recordUserMessage(session.userId, parsed.data.message),
        await recordAssistantMessage({
          userId: session.userId,
          text,
          proposal: null,
          requiresConfirmation: false,
        }),
      ];

      return NextResponse.json({
        userMessage,
        assistantMessage,
        reply: { text, proposal: null, requiresConfirmation: false },
      });
    }

    const travelDate = appDateOnly();
    const localNow = appLocalDate();

    // Demand figures must belong to the city the user's plan is in.
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { cityCode: true },
    });
    const activeCity = getCity(user?.cityCode);

    const [context, recommendation, intention] = await Promise.all([
      loadDemandContext(activeCity.code, travelDate, localNow),
      prisma.recommendation.findUnique({
        where: { userId_travelDate: { userId: session.userId, travelDate } },
        select: { recommendedDeparture: true },
      }),
      prisma.travelIntention.findUnique({
        where: { userId_travelDate: { userId: session.userId, travelDate } },
        select: { updatedDeparture: true, status: true },
      }),
    ]);

    // "What you are planned to do right now": a confirmed intention wins over
    // the routine, because it is the more recent statement of fact.
    const currentDeparture =
      intention && intention.status === "CONFIRMED"
        ? intention.updatedDeparture
        : profile.usualDeparture;

    const assistantContext = {
      usualDeparture: profile.usualDeparture,
      currentDeparture,
      requiredArrival: profile.requiredArrival,
      typicalJourneyMinutes: profile.typicalJourneyMinutes,
      primaryMode: profile.primaryMode,
      cityName: activeCity.name,
      demandAt: demandAtFor(context),
      recommendedDeparture:
        recommendation?.recommendedDeparture ?? profile.usualDeparture,
    };

    const intent = parseIntent(parsed.data.message, assistantContext);
    const reply = buildAssistantReply(intent, assistantContext);

    // Store both sides of the exchange, in order.
    const userMessage = await recordUserMessage(session.userId, parsed.data.message);
    const assistantMessage = await recordAssistantMessage({
      userId: session.userId,
      text: reply.text,
      proposal: reply.proposal,
      requiresConfirmation: reply.requiresConfirmation,
    });

    return NextResponse.json({
      userMessage,
      assistantMessage,
      reply,
      intentKind: intent.kind,
    });
  } catch (error) {
    console.error("[chat] failed:", error);
    return NextResponse.json(
      { error: "The assistant is unavailable right now. Please try again." },
      { status: 500 }
    );
  }
}
