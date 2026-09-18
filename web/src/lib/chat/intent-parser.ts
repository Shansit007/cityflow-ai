import { roundToSlot, toMinutes, toTimeString } from "@/lib/demand/time-slots";
import { parseShift, parseTime, soundsUncertain } from "@/lib/chat/time-parse";
import {
  CONFIDENT_TOPIC_SCORE,
  WEAK_TOPIC_SCORE,
  looksLikeAppQuestion,
  matchTopics,
} from "@/lib/chat/app-guide";
import type { TransportMode } from "@/lib/travel";

/**
 * TRAVEL INTENT RECOGNITION.
 *
 * Turns a sentence a commuter typed into a structured proposal the rest of the
 * system can act on.
 *
 * ============================== HONESTY NOTE ================================
 * This is a RULE-BASED parser, not a large language model. It matches patterns
 * and extracts times. That choice is deliberate:
 *
 *   - it costs nothing and needs no API key, which the project requires;
 *   - it is deterministic, so the same sentence always yields the same
 *     proposal, and the confirmation card can be trusted;
 *   - it is auditable — you can point at the rule that fired.
 *
 * The trade-off is real and is not hidden from the user: it understands travel
 * sentences, not open conversation. When it does not understand something it
 * says so and offers examples, rather than guessing.
 *
 * `parseIntent()` is the seam. Swapping in a hosted model later means returning
 * the same `ParsedIntent` shape from a different implementation; nothing
 * downstream changes.
 * ============================================================================
 */

export type IntentKind =
  /** "I want to leave at 6 PM today" */
  | "SET_DEPARTURE"
  /** "I can leave 30 minutes late today" */
  | "SHIFT_DEPARTURE"
  /** "I need to reach office by 9" */
  | "SET_ARRIVAL"
  /** "I don't want to leave before 8" */
  | "NOT_BEFORE"
  /** "I want to take the metro" / "I don't want to drive today" */
  | "SET_MODE"
  /** "I'm not travelling today" */
  | "CANCEL_TRIP"
  /** "Go back to my usual time" */
  | "REVERT_TO_USUAL"
  /** "My destination is different today" — a route change, not a time change. */
  | "CHANGE_ROUTE"
  /** "When should I leave?" */
  | "ASK_RECOMMENDATION"
  /** "What's traffic like at 6?" */
  | "ASK_TRAFFIC"
  /** "What can you do?" */
  | "HELP"
  /** "Where do I report a pothole?" — a question about the app itself. */
  | "ASK_APP_HELP"
  /** "Thanks", "ok", "bye" — acknowledge, do not lecture. */
  | "SMALL_TALK"
  | "GREETING"
  | "UNKNOWN";

/** The structured change a sentence is proposing. Never saved without confirmation. */
export interface IntentProposal {
  /** New departure time, "HH:MM". */
  updatedDeparture?: string;
  /** New transport mode for this trip. */
  transportMode?: TransportMode;
  /** True when the person is not travelling at all. */
  cancel?: boolean;
}

export interface ParsedIntent {
  kind: IntentKind;
  /** The structured change, when the sentence proposes one. */
  proposal?: IntentProposal;
  /**
   * True when the user must confirm before anything is written.
   *
   * Set when the sentence hedges ("I think I might…"), or when a time had to be
   * guessed as AM or PM. A definite sentence with an unambiguous time is applied
   * directly — and can still be undone.
   */
  requiresConfirmation: boolean;
  /** Why confirmation is being asked for, shown on the card. */
  confirmationReason?: "uncertain-wording" | "ambiguous-time";
  /** The fragment the parser matched, quoted back so the reading is visible. */
  matchedText?: string;
  /** A time the sentence mentioned but that is not itself the proposal. */
  referencedTime?: string;
  /** For ASK_APP_HELP: which entry in lib/chat/app-guide.ts answers this. */
  topicId?: string;
  /**
   * For UNKNOWN: a topic that ALMOST matched, offered as "did you mean…".
   * Deliberately separate from `topicId` — a weak match is a guess, and the
   * reply must present it as one rather than answering as though it were sure.
   */
  suggestedTopicId?: string;
  /** The small-talk flavour, so the reply can be appropriate. */
  smallTalk?: "thanks" | "affirm" | "farewell";
}

/** What the parser needs to know about the person to read a sentence correctly. */
export interface IntentContext {
  /** Their usual departure, "HH:MM". Used to read "8" as 8 AM or 8 PM. */
  usualDeparture: string;
  /** Their current plan for today, "HH:MM". */
  currentDeparture: string;
  requiredArrival: string;
  typicalJourneyMinutes: number;
  primaryMode: TransportMode;
}

/* -------------------------------------------------------------------------- */
/*  Small matchers                                                             */
/* -------------------------------------------------------------------------- */

const MODE_PATTERNS: Array<{ mode: TransportMode; positive: RegExp; negative?: RegExp }> = [
  { mode: "METRO", positive: /\b(metro|train|rail|subway)\b/ },
  { mode: "BUS", positive: /\bbus\b/ },
  { mode: "CAR", positive: /\b(car|drive|driving)\b/ },
  { mode: "BIKE", positive: /\b(bike|scooter|two.?wheeler|scooty)\b/ },
  { mode: "CYCLE", positive: /\b(cycle|cycling|bicycle)\b/ },
  { mode: "WALK", positive: /\b(walk|walking|on foot)\b/ },
  { mode: "OTHER", positive: /\b(auto|rickshaw|cab|taxi|uber|ola|shared)\b/ },
];

const NEGATION = /\b(don'?t|do not|not|no|avoid|rather not|can'?t|cannot)\b/;

/* -------------------------------------------------------------------------- */
/*  The parser                                                                 */
/* -------------------------------------------------------------------------- */

export function parseIntent(rawText: string, context: IntentContext): ParsedIntent {
  const text = rawText.trim();
  const input = text.toLowerCase();

  if (input.length === 0) return { kind: "UNKNOWN", requiresConfirmation: false };

  const uncertain = soundsUncertain(input);
  const reference = toMinutes(context.usualDeparture) ?? 9 * 60;

  // ------------------------------------------------------------- greeting
  if (/^(hi|hello|hey|namaste|good (morning|afternoon|evening))\b/.test(input)) {
    return { kind: "GREETING", requiresConfirmation: false };
  }

  // ----------------------------------------------------------- small talk
  /*
    "Thanks", "ok", "bye" are not travel instructions and they are not failures
    to understand either. Before this existed they fell through to UNKNOWN and
    were answered with a list of example sentences, which reads as though the
    assistant was not listening. Acknowledging them costs three lines.
  */
  if (/^\s*(thanks|thank you|thx|ty|great|perfect|nice|awesome|cool|good job|well done)\b/.test(input)) {
    return { kind: "SMALL_TALK", smallTalk: "thanks", requiresConfirmation: false };
  }
  if (/^\s*(ok|okay|k|sure|fine|right|got it|understood|alright|yes|yeah|yep)\s*[.!]?\s*$/.test(input)) {
    return { kind: "SMALL_TALK", smallTalk: "affirm", requiresConfirmation: false };
  }
  if (/^\s*(bye|goodbye|see you|good night|gn|tata|chalo)\b/.test(input)) {
    return { kind: "SMALL_TALK", smallTalk: "farewell", requiresConfirmation: false };
  }

  // ----------------------------------------------------------------- help
  if (/\b(help|what can you do|how do (you|i) (work|use)|options)\b/.test(input)) {
    return { kind: "HELP", requiresConfirmation: false };
  }

  // ------------------------------------------------------------- cancel
  if (
    /\b(not travel|not travelling|not traveling|not going|no trip|cancel (my )?(trip|travel|plan)|staying home|working from home|wfh|day off|holiday today|leave cancelled)\b/.test(
      input
    )
  ) {
    return {
      kind: "CANCEL_TRIP",
      proposal: { cancel: true },
      requiresConfirmation: uncertain,
      confirmationReason: uncertain ? "uncertain-wording" : undefined,
      matchedText: text,
    };
  }

  // ------------------------------------------------------ back to normal
  if (/\b(usual|normal|regular|original|default)\b.*\b(time|schedule|routine|plan)\b/.test(input) ||
      /\b(go back|revert|reset|undo)\b/.test(input)) {
    return {
      kind: "REVERT_TO_USUAL",
      proposal: { updatedDeparture: context.usualDeparture },
      requiresConfirmation: false,
      matchedText: text,
    };
  }

  // --------------------------------------------------------- route change
  // A different origin or destination is not something the assistant can infer
  // safely — it would need a new area name, and getting that wrong would put a
  // person's trip in the wrong demand zone. It points at the profile instead.
  if (
    /\b(destination|origin|route|going somewhere else|different (place|location|office|area)|another (place|location|office)|work from|new office|new address)\b/.test(
      input
    )
  ) {
    return { kind: "CHANGE_ROUTE", requiresConfirmation: false, matchedText: text };
  }

  // ------------------------------------------------- questions (read-only)
  if (
    /\b(when should i|what time should i|when do i|best time to)\b/.test(input) ||
    /^\s*(when|what time)\b.*\?/.test(input)
  ) {
    return { kind: "ASK_RECOMMENDATION", requiresConfirmation: false };
  }

  /*
    ----------------------------- QUESTIONS ABOUT THE APP --------------------
    "Where do I report a pothole?", "what does this 0-100 number mean?", "who
    can see my data?". These are perfectly reasonable questions that used to
    fall through to UNKNOWN and get answered with a list of travel sentences.

    ORDER MATTERS HERE, and the two guards below are the whole trick:

      1. The sentence must be SHAPED like a question about the product
         ("how do I…", "where is…", "what is…"), not like an instruction.
      2. It must not be a travel question wearing the same clothes. "What is
         traffic like at 6 PM" and "how does traffic prediction work" both
         mention traffic; the first carries a clock time and a travel subject,
         and belongs to ASK_TRAFFIC below. So a message that has BOTH a
         parseable time AND a travel subject is never treated as an app
         question.

    ASK_RECOMMENDATION is checked above this, because "when should I leave?"
    is unambiguous and deserves the real answer rather than a page link.
  */
  const topicMatches = matchTopics(input);
  const bestTopic = topicMatches[0];

  const mentionsTravelSubject =
    /\b(traffic|busy|congestion|jam|crowded|leave|leaving|depart|reach|arrive|arriving|travel|trip|commute)\b/.test(
      input
    );
  const carriesATime = parseTime(input, reference) !== null;
  const isTravelQuestionInDisguise = carriesATime && mentionsTravelSubject;

  if (
    looksLikeAppQuestion(input) &&
    bestTopic &&
    bestTopic.score >= CONFIDENT_TOPIC_SCORE &&
    !isTravelQuestionInDisguise
  ) {
    return {
      kind: "ASK_APP_HELP",
      topicId: bestTopic.topic.id,
      requiresConfirmation: false,
      matchedText: text,
    };
  }

  if (/\b(traffic|busy|congestion|demand|crowded|jam)\b/.test(input)) {
    const at = parseTime(input, reference);
    return {
      kind: "ASK_TRAFFIC",
      requiresConfirmation: false,
      referencedTime: at ? toTimeString(roundToSlot(at.minutes)) : undefined,
    };
  }

  // ------------------------------------------------------------- mode
  // Checked before times, because "I want to take the metro at 6" is really two
  // statements and the mode is the more unusual one to get wrong.
  for (const pattern of MODE_PATTERNS) {
    if (!pattern.positive.test(input)) continue;

    // "I don't want to drive today" means: not CAR — which we cannot turn into
    // a single new mode, so we ask rather than guess.
    const negated = NEGATION.test(input.slice(0, input.search(pattern.positive) + 1));

    if (negated) {
      return {
        kind: "SET_MODE",
        requiresConfirmation: true,
        confirmationReason: "uncertain-wording",
        matchedText: text,
      };
    }

    return {
      kind: "SET_MODE",
      proposal: { transportMode: pattern.mode },
      requiresConfirmation: uncertain,
      confirmationReason: uncertain ? "uncertain-wording" : undefined,
      matchedText: text,
    };
  }

  // --------------------------------------------------------- "not before X"
  const notBefore = /\b(?:don'?t|do not|can'?t|cannot|won'?t|not)\b[^.]{0,25}\bbefore\b/.test(
    input
  );
  if (notBefore) {
    const floor = parseTime(input, reference);
    if (floor) {
      const floorSlot = roundToSlot(floor.minutes);
      const current = toMinutes(context.currentDeparture) ?? reference;

      return {
        kind: "NOT_BEFORE",
        // Only propose a change if their current plan actually breaks the limit.
        proposal:
          current < floorSlot ? { updatedDeparture: toTimeString(floorSlot) } : undefined,
        requiresConfirmation: uncertain || floor.inferredMeridiem,
        confirmationReason: floor.inferredMeridiem
          ? "ambiguous-time"
          : uncertain
            ? "uncertain-wording"
            : undefined,
        matchedText: floor.matchedText,
        referencedTime: toTimeString(floorSlot),
      };
    }
  }

  // ---------------------------------------------------------- arrival time
  if (/\b(reach|arrive|be (at|in)|get (to|there)|reaching)\b/.test(input)) {
    const arrival = parseTime(input, toMinutes(context.requiredArrival) ?? reference);
    if (arrival) {
      // Work backwards using the journey time the PERSON gave us. No invented
      // travel-time model, and the reply says so.
      const departure = roundToSlot(arrival.minutes - context.typicalJourneyMinutes);

      return {
        kind: "SET_ARRIVAL",
        proposal: { updatedDeparture: toTimeString(departure) },
        requiresConfirmation: true,
        confirmationReason: arrival.inferredMeridiem
          ? "ambiguous-time"
          : "uncertain-wording",
        matchedText: arrival.matchedText,
        referencedTime: toTimeString(roundToSlot(arrival.minutes)),
      };
    }
  }

  // ------------------------------------------------------- relative shift
  const shift = parseShift(input);
  if (shift) {
    const current = toMinutes(context.currentDeparture) ?? reference;
    const shifted = roundToSlot(current + shift.offsetMinutes);

    return {
      kind: "SHIFT_DEPARTURE",
      proposal: { updatedDeparture: toTimeString(shifted) },
      requiresConfirmation: uncertain,
      confirmationReason: uncertain ? "uncertain-wording" : undefined,
      matchedText: shift.matchedText,
    };
  }

  // ------------------------------------- bare direction: "leaving earlier today"
  if (/\b(leaving|leave|depart|starting)\b/.test(input) && /\b(earlier|early|later|late)\b/.test(input)) {
    const earlier = /\b(earlier|early)\b/.test(input);
    const current = toMinutes(context.currentDeparture) ?? reference;
    const shifted = roundToSlot(current + (earlier ? -30 : 30));

    return {
      kind: "SHIFT_DEPARTURE",
      proposal: { updatedDeparture: toTimeString(shifted) },
      // No amount was given, so 30 minutes is our assumption — always confirm.
      requiresConfirmation: true,
      confirmationReason: "uncertain-wording",
      matchedText: text,
    };
  }

  // ------------------------------------------------------- departure time
  const departure = parseTime(input, reference);
  // NOTE: this list spells out whole words on purpose. An earlier version used
  // prefixes like `leav` with a trailing \b, which can never match "leave" —
  // there is no word boundary between "v" and "e". The effect was that clear
  // instructions were treated as guesses and needlessly asked for confirmation.
  const DEPARTURE_VERBS =
    /\b(leave|leaving|leaves|left|depart|departing|departure|start|starting|set off|setting off|head|heading|go|going|travel|travelling|traveling|out)\b/;

  if (departure && DEPARTURE_VERBS.test(input)) {
    const slot = roundToSlot(departure.minutes);

    return {
      kind: "SET_DEPARTURE",
      proposal: { updatedDeparture: toTimeString(slot) },
      requiresConfirmation: uncertain || departure.inferredMeridiem,
      confirmationReason: departure.inferredMeridiem
        ? "ambiguous-time"
        : uncertain
          ? "uncertain-wording"
          : undefined,
      matchedText: departure.matchedText,
    };
  }

  /*
    A time on its own ("6 PM?") is most likely a departure, but we are guessing.

    Never guess this from a question about the product, though. "What is the
    0-100 index?" must not become "shall I move you to 1:00?" — answering a
    question with an unrelated offer to change somebody's travel plan is the
    kind of thing that makes people stop trusting an assistant entirely.
  */
  if (departure && !looksLikeAppQuestion(input)) {
    const slot = roundToSlot(departure.minutes);
    return {
      kind: "SET_DEPARTURE",
      proposal: { updatedDeparture: toTimeString(slot) },
      requiresConfirmation: true,
      confirmationReason: departure.inferredMeridiem
        ? "ambiguous-time"
        : "uncertain-wording",
      matchedText: departure.matchedText,
    };
  }

  /*
    Nothing matched. Before giving up, check whether a topic ALMOST matched —
    somebody typing "pothole" alone has clearly asked something, and offering
    "did you mean reporting a road problem?" is far more use than a list of
    travel sentences. It is offered as a question, never answered as fact,
    because a weak match is a guess and should look like one.
  */
  const weak = topicMatches[0];

  return {
    kind: "UNKNOWN",
    requiresConfirmation: false,
    suggestedTopicId:
      weak && weak.score >= WEAK_TOPIC_SCORE ? weak.topic.id : undefined,
  };
}
