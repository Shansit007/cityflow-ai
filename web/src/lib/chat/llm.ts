import { z } from "zod";

import type { IntentContext, IntentKind, ParsedIntent } from "@/lib/chat/intent-parser";
import { parseIntent } from "@/lib/chat/intent-parser";
import { roundToSlot, toMinutes, toTimeString } from "@/lib/demand/time-slots";
import type { TransportMode } from "@/lib/travel";

/**
 * OPTIONAL hosted-model layer for the assistant, on top of the rule-based parser.
 *
 * ============================== HONESTY NOTE =================================
 * intent-parser.ts is unchanged by this file and remains exactly what it says it
 * is: free, deterministic, auditable, and the WHOLE assistant when no model is
 * configured. This file adds a second attempt for the sentences that parser
 * genuinely could not classify — nothing more.
 *
 * WHY THE RULE-BASED PARSER RUNS FIRST, NOT THE MODEL
 * A hosted call costs money (even on a free tier, it costs latency and a rate
 * limit) and is not deterministic — the same sentence could, in principle, be
 * read two different ways on two different days. The regex parser above is
 * already right for the large majority of real commuter sentences and never
 * varies. So it always runs first, synchronously, for free. The model is only
 * asked when the parser's answer is "I did not understand this at all" —
 * genuine UNKNOWN, not even a weak topic match — and only when GROQ_API_KEY is
 * configured. Ask it anything else and you are paying latency to replace an
 * answer that was already correct.
 *
 * WHAT THE MODEL IS — AND IS NOT — TRUSTED TO DO
 * It is asked to do exactly one thing a regex cannot: read open, indirect or
 * unusual phrasing and say which of the SAME fixed intents (below) it matches,
 * and extract a clock time or mode from it. It is never asked to pick an
 * ASK_APP_HELP topic — that would mean trusting it to name one of the ids in
 * app-guide.ts from memory, and a made-up id would either crash or silently
 * answer the wrong question. It is never asked to compute a final departure
 * time itself — that arithmetic (rounding to a slot, working an arrival
 * backwards through the journey time) is done here in code, the same way
 * intent-parser.ts does it, so a model's arithmetic mistake can never reach a
 * person's travel plan. And its JSON is validated against a strict schema
 * before a single field of it is trusted; anything that fails validation, times
 * out, or errors is treated exactly like "the model was not configured" —
 * silently falls back to the parser's original, honest "I did not follow that"
 * reply. The confirmation step downstream is completely unaware which layer
 * produced a proposal, and unchanged by this file: nothing is ever written
 * without the person seeing the exact card and pressing Confirm.
 * ============================================================================
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const DEFAULT_MODEL = "llama-3.1-8b-instant";
const DEFAULT_TIMEOUT_MS = 3000;

/** The subset of IntentKind the model is allowed to return. No ASK_APP_HELP. */
const MODEL_KINDS = [
  "SET_DEPARTURE",
  "SHIFT_DEPARTURE",
  "SET_ARRIVAL",
  "NOT_BEFORE",
  "SET_MODE",
  "CANCEL_TRIP",
  "REVERT_TO_USUAL",
  "CHANGE_ROUTE",
  "ASK_RECOMMENDATION",
  "ASK_TRAFFIC",
  "HELP",
  "SMALL_TALK",
  "GREETING",
  "UNKNOWN",
] as const satisfies readonly IntentKind[];

const llmResponseSchema = z.object({
  kind: z.enum(MODEL_KINDS),
  /** HH:MM, 24-hour, already resolved from whatever the sentence said. */
  timeMentioned: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .optional(),
  transportMode: z
    .enum(["CAR", "BIKE", "BUS", "METRO", "WALK", "CYCLE", "OTHER"])
    .nullable()
    .optional(),
  cancel: z.boolean().optional(),
  /** True if the model had to guess AM vs PM. */
  ambiguousTime: z.boolean().optional(),
  /** True if the sentence hedges ("I think", "maybe"). */
  uncertainWording: z.boolean().optional(),
  smallTalk: z.enum(["thanks", "affirm", "farewell"]).nullable().optional(),
});

function systemPrompt(context: IntentContext): string {
  return [
    "You read one sentence from a commuter using a city travel-planning app and classify it. Reply with ONLY a JSON object, no other text.",
    "",
    "Fields to return:",
    `- kind: exactly one of ${MODEL_KINDS.join(", ")}`,
    "- timeMentioned: the clock time the sentence is about, as 24-hour HH:MM, or null if none. Resolve relative phrases (\"in half an hour\", \"half past 7 tonight\") against the context below. For SET_ARRIVAL this is the ARRIVAL time the person named, not a departure.",
    "- transportMode: one of CAR, BIKE, BUS, METRO, WALK, CYCLE, OTHER, or null.",
    "- cancel: true only if the person says they are not travelling at all today.",
    "- ambiguousTime: true if you had to guess whether a time was AM or PM.",
    "- uncertainWording: true if the sentence hedges (\"I think\", \"maybe\", \"probably\").",
    "- smallTalk: for kind SMALL_TALK only — \"thanks\", \"affirm\" (ok/yes/sure on its own) or \"farewell\".",
    "",
    "Context (24-hour clock):",
    `- Their usual departure: ${context.usualDeparture}`,
    `- Their current plan for today: ${context.currentDeparture}`,
    `- They must arrive by: ${context.requiredArrival}`,
    `- Their journey normally takes ${context.typicalJourneyMinutes} minutes`,
    `- Their usual transport mode: ${context.primaryMode}`,
    "",
    "Rules:",
    "- SET_ARRIVAL is for \"I need to reach/arrive by X\" — X goes in timeMentioned as the arrival, not a departure.",
    "- NOT_BEFORE is for \"I don't want to leave before X\" / \"not before X\".",
    "- SHIFT_DEPARTURE is a RELATIVE change with no clock time (\"leaving 20 minutes late\", \"a bit earlier\") — leave timeMentioned null in that case.",
    "- CHANGE_ROUTE is only for a DIFFERENT origin, destination or office — never a time change.",
    "- If the sentence does not clearly match any of these, return kind UNKNOWN and leave the other fields null/false.",
    "- Never invent a time that was not stated or clearly implied.",
  ].join("\n");
}

/**
 * Turns the model's raw (already-validated) judgement into the exact same
 * `ParsedIntent` shape `parseIntent()` produces, doing the slot-rounding and
 * arrival-backwards arithmetic ourselves rather than trusting the model with it.
 */
function toParsedIntent(
  raw: z.infer<typeof llmResponseSchema>,
  rawText: string,
  context: IntentContext
): ParsedIntent {
  const uncertain = Boolean(raw.uncertainWording);
  const ambiguous = Boolean(raw.ambiguousTime);

  switch (raw.kind) {
    case "GREETING":
      return { kind: "GREETING", requiresConfirmation: false };

    case "SMALL_TALK":
      return {
        kind: "SMALL_TALK",
        smallTalk: raw.smallTalk ?? "affirm",
        requiresConfirmation: false,
      };

    case "HELP":
      return { kind: "HELP", requiresConfirmation: false };

    case "ASK_RECOMMENDATION":
      return { kind: "ASK_RECOMMENDATION", requiresConfirmation: false };

    case "ASK_TRAFFIC":
      return {
        kind: "ASK_TRAFFIC",
        requiresConfirmation: false,
        referencedTime: raw.timeMentioned
          ? toTimeString(roundToSlot(toMinutes(raw.timeMentioned) ?? 0))
          : undefined,
      };

    case "CHANGE_ROUTE":
      return { kind: "CHANGE_ROUTE", requiresConfirmation: false, matchedText: rawText };

    case "CANCEL_TRIP":
      return {
        kind: "CANCEL_TRIP",
        proposal: { cancel: true },
        requiresConfirmation: uncertain,
        confirmationReason: uncertain ? "uncertain-wording" : undefined,
        matchedText: rawText,
      };

    case "REVERT_TO_USUAL":
      return {
        kind: "REVERT_TO_USUAL",
        proposal: { updatedDeparture: context.usualDeparture },
        requiresConfirmation: false,
        matchedText: rawText,
      };

    case "SET_MODE": {
      if (!raw.transportMode) return { kind: "UNKNOWN", requiresConfirmation: false };
      return {
        kind: "SET_MODE",
        proposal: { transportMode: raw.transportMode as TransportMode },
        requiresConfirmation: uncertain,
        confirmationReason: uncertain ? "uncertain-wording" : undefined,
        matchedText: rawText,
      };
    }

    case "NOT_BEFORE": {
      if (!raw.timeMentioned) return { kind: "UNKNOWN", requiresConfirmation: false };
      const floorSlot = roundToSlot(toMinutes(raw.timeMentioned) ?? 0);
      const current = toMinutes(context.currentDeparture) ?? floorSlot;

      return {
        kind: "NOT_BEFORE",
        proposal: current < floorSlot ? { updatedDeparture: toTimeString(floorSlot) } : undefined,
        requiresConfirmation: uncertain || ambiguous,
        confirmationReason: ambiguous ? "ambiguous-time" : uncertain ? "uncertain-wording" : undefined,
        matchedText: rawText,
        referencedTime: toTimeString(floorSlot),
      };
    }

    case "SET_ARRIVAL": {
      if (!raw.timeMentioned) return { kind: "UNKNOWN", requiresConfirmation: false };
      const arrivalMinutes = toMinutes(raw.timeMentioned) ?? 0;
      const departure = roundToSlot(arrivalMinutes - context.typicalJourneyMinutes);

      return {
        kind: "SET_ARRIVAL",
        proposal: { updatedDeparture: toTimeString(departure) },
        requiresConfirmation: true,
        confirmationReason: ambiguous ? "ambiguous-time" : "uncertain-wording",
        matchedText: rawText,
        referencedTime: toTimeString(roundToSlot(arrivalMinutes)),
      };
    }

    case "SHIFT_DEPARTURE":
    case "SET_DEPARTURE": {
      if (!raw.timeMentioned) return { kind: "UNKNOWN", requiresConfirmation: false };
      const slot = roundToSlot(toMinutes(raw.timeMentioned) ?? 0);

      return {
        kind: raw.kind,
        proposal: { updatedDeparture: toTimeString(slot) },
        requiresConfirmation: uncertain || ambiguous,
        confirmationReason: ambiguous ? "ambiguous-time" : uncertain ? "uncertain-wording" : undefined,
        matchedText: rawText,
      };
    }

    default:
      return { kind: "UNKNOWN", requiresConfirmation: false };
  }
}

/** Reads GROQ_TIMEOUT_MS the same defensive way the ML service timeout is read. */
function timeoutMs(): number {
  const raw = Number(process.env.GROQ_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

/**
 * Asks the hosted model to classify a sentence the rule-based parser could not.
 * Returns null on ANY problem — missing key, network failure, timeout, or a
 * response that fails validation — so the caller's existing UNKNOWN handling
 * (an honest "I did not follow that", with examples) is always the fallback.
 */
async function tryLLMIntent(
  rawText: string,
  context: IntentContext
): Promise<ParsedIntent | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());

  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || DEFAULT_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt(context) },
          { role: "user", content: rawText.slice(0, 400) },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const body = await response.json();
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(content);
    } catch {
      return null;
    }

    const result = llmResponseSchema.safeParse(parsedJson);
    if (!result.success) return null;

    return toParsedIntent(result.data, rawText, context);
  } catch {
    // Network error, timeout (AbortError), or anything else — fail open.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The seam `intent-parser.ts` was written to expect: same input, same
 * `ParsedIntent` output, and — when GROQ_API_KEY is unset — EXACTLY the
 * behaviour of calling `parseIntent()` directly, with no added latency.
 */
export async function parseIntentSmart(
  rawText: string,
  context: IntentContext
): Promise<ParsedIntent> {
  const ruleBased = parseIntent(rawText, context);

  // Anything the deterministic parser actually understood — including a weak
  // "did you mean…" topic guess — is left alone. The model is only consulted
  // when the parser found nothing at all to say.
  const genuinelyUnknown = ruleBased.kind === "UNKNOWN" && !ruleBased.suggestedTopicId;
  if (!genuinelyUnknown) return ruleBased;

  const fromModel = await tryLLMIntent(rawText, context);
  return fromModel ?? ruleBased;
}
