/**
 * Understanding times written the way people actually type them.
 *
 * "6 PM", "6pm", "18:00", "6:30", "half 6", "quarter past 8", "in an hour",
 * "half an hour later", "30 mins early".
 *
 * WHY THIS IS HAND-WRITTEN RATHER THAN A LIBRARY OR AN LLM
 *  - It is free and offline. No API key, no rate limit, no vendor that might
 *    start charging. That was a hard requirement for this project.
 *  - It is deterministic. The same sentence always produces the same time, so
 *    the confirmation card a person sees can be trusted, and the behaviour can
 *    be tested.
 *  - It is auditable. A traffic system that changes someone's morning should be
 *    able to show exactly why it read "6" as 6 PM.
 *
 * Everything it produces is treated as a PROPOSAL. Nothing is written to the
 * database until the person confirms it on screen.
 */

import type { DayPart } from "@/lib/journeys/journey-service";

/** A time the parser found in a sentence. */
export interface ParsedTime {
  /** Minutes since midnight. */
  minutes: number;
  /** The exact text it came from, so the UI can quote it back. */
  matchedText: string;
  /**
   * True when the sentence did not say AM or PM and the hour was ambiguous
   * (1-12). The reading was inferred, so the person must confirm it.
   */
  inferredMeridiem: boolean;
}

/** A relative shift, e.g. "30 minutes later". */
export interface ParsedShift {
  /** Signed minutes. Negative means earlier. */
  offsetMinutes: number;
  matchedText: string;
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  quarter: 15,
  half: 30,
  an: 1,
  a: 1,
};

/**
 * Chooses AM or PM for an hour the sentence left ambiguous.
 *
 * The rule: pick whichever reading is closer to the time the person normally
 * travels. Someone whose routine starts at 09:00 who types "leaving at 8" means
 * 8 AM; someone whose routine starts at 18:00 means 8 PM. This is a guess, so
 * the caller marks it `inferredMeridiem` and the UI asks before saving.
 */
function inferMeridiem(hour12: number, referenceMinutes: number): number {
  if (hour12 === 12) {
    // "12" is midday far more often than midnight in a travel conversation.
    const noon = 12 * 60;
    const midnight = 0;
    return Math.abs(noon - referenceMinutes) <= Math.abs(midnight - referenceMinutes)
      ? noon
      : midnight;
  }

  const asAm = hour12 * 60;
  const asPm = (hour12 + 12) * 60;

  return Math.abs(asAm - referenceMinutes) <= Math.abs(asPm - referenceMinutes)
    ? asAm
    : asPm;
}

/**
 * Finds a clock time in a sentence.
 *
 * @param text              What the person typed.
 * @param referenceMinutes  Their usual departure, used to resolve "8" into
 *                          8 AM or 8 PM.
 */
export function parseTime(text: string, referenceMinutes: number): ParsedTime | null {
  const input = text.toLowerCase();

  // ---------------------------------------------------- 1. "18:00", "6:30 pm"
  const clock = /\b(\d{1,2})[:.](\d{2})\s*(a\.?m\.?|p\.?m\.?)?/.exec(input);
  if (clock) {
    let hour = Number(clock[1]);
    const minute = Number(clock[2]);
    const meridiem = clock[3]?.replace(/\./g, "");

    if (minute > 59 || hour > 23) return null;

    let inferred = false;

    if (meridiem === "pm" && hour < 12) hour += 12;
    else if (meridiem === "am" && hour === 12) hour = 0;
    else if (!meridiem && hour <= 12) {
      // "6:30" with no am/pm — infer from their routine, then flag it so the
      // person is asked to confirm which one we meant.
      hour = Math.floor(inferMeridiem(hour, referenceMinutes) / 60);
      inferred = true;
    }

    return {
      minutes: hour * 60 + minute,
      matchedText: clock[0].trim(),
      inferredMeridiem: inferred && !meridiem,
    };
  }

  // ------------------------------------------- 2. "6pm", "6 p.m.", "18 hours"
  const bareWithMeridiem = /\b(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)\b/.exec(input);
  if (bareWithMeridiem) {
    let hour = Number(bareWithMeridiem[1]);
    const meridiem = bareWithMeridiem[2].replace(/\./g, "");

    if (hour > 12) return null;
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;

    return {
      minutes: hour * 60,
      matchedText: bareWithMeridiem[0].trim(),
      inferredMeridiem: false,
    };
  }

  // ------------------------------- 3. "quarter past 8", "half past 6", "half 6"
  const past = /\b(quarter|half|ten|five|twenty)\s*(?:past\s*)?(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/.exec(
    input
  );
  if (past && /\b(quarter|half)\b/.test(past[1])) {
    const offset = WORD_NUMBERS[past[1]] ?? 0;
    const hourToken = past[2];
    const hour12 = Number(hourToken) || WORD_NUMBERS[hourToken] || 0;

    if (hour12 >= 1 && hour12 <= 12) {
      const base = inferMeridiem(hour12, referenceMinutes);
      return {
        minutes: base + offset,
        matchedText: past[0].trim(),
        inferredMeridiem: true,
      };
    }
  }

  // ---------------------------------------- 4. "quarter to 7", "ten to eight"
  const to = /\b(quarter|half|ten|five|twenty)\s*to\s*(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/.exec(
    input
  );
  if (to) {
    const offset = WORD_NUMBERS[to[1]] ?? Number(to[1]) ?? 0;
    const hourToken = to[2];
    const hour12 = Number(hourToken) || WORD_NUMBERS[hourToken] || 0;

    if (hour12 >= 1 && hour12 <= 12) {
      const base = inferMeridiem(hour12, referenceMinutes);
      return {
        minutes: base - offset,
        matchedText: to[0].trim(),
        inferredMeridiem: true,
      };
    }
  }

  // -------------------------------- 5. bare hour: "leave at 6", "around eight"
  const bare = /\b(?:at|by|around|about|near)\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/.exec(
    input
  );
  if (bare) {
    const token = bare[1];
    const value = Number(token) || WORD_NUMBERS[token] || 0;

    if (value >= 0 && value <= 23) {
      // 13-23 can only be a 24-hour reading, so nothing is inferred.
      if (value > 12) {
        return { minutes: value * 60, matchedText: bare[0].trim(), inferredMeridiem: false };
      }

      return {
        minutes: inferMeridiem(value, referenceMinutes),
        matchedText: bare[0].trim(),
        inferredMeridiem: true,
      };
    }
  }

  return null;
}

/**
 * Finds a relative shift: "30 minutes later", "an hour earlier", "15 mins late".
 * Returns signed minutes — negative for earlier.
 */
export function parseShift(text: string): ParsedShift | null {
  const input = text.toLowerCase();

  const match =
    /\b(\d{1,3}|an|a|half|quarter|one|two|three)\s*(minute|minutes|min|mins|hour|hours|hr|hrs)\b[^.]{0,20}?\b(later|late|earlier|early|before|after|sooner)\b/.exec(
      input
    ) ??
    /\b(later|earlier|sooner)\b[^.]{0,15}?\b(\d{1,3}|an|a|half|quarter)\s*(minute|minutes|min|mins|hour|hours|hr|hrs)\b/.exec(
      input
    );

  if (!match) return null;

  const amountToken = /\d|an|a|half|quarter|one|two|three/.exec(match[0])?.[0] ?? "";
  const unitIsHour = /\b(hour|hours|hr|hrs)\b/.test(match[0]);
  const direction = /\b(earlier|early|before|sooner)\b/.test(match[0]) ? -1 : 1;

  let amount = Number(amountToken);
  if (Number.isNaN(amount)) amount = WORD_NUMBERS[amountToken] ?? 0;

  if (amount === 0) return null;

  // "half an hour" -> WORD_NUMBERS gives 30, which is already minutes.
  const minutes =
    unitIsHour && amountToken !== "half" && amountToken !== "quarter"
      ? amount * 60
      : unitIsHour
        ? amount // "half an hour" = 30, "quarter of an hour" = 15
        : amount;

  return { offsetMinutes: direction * minutes, matchedText: match[0].trim() };
}

/**
 * Detects hedging — the difference between "I am leaving at 6" and "I might
 * leave at 6".
 *
 * An uncertain statement is never written to the database. The assistant asks
 * a yes/no question first. This is a product rule, not a nicety: an aggregated
 * demand figure built from things people were only musing about would be worse
 * than no figure at all.
 */
const HEDGE_WORDS = [
  "think",
  "thinking",
  "might",
  "maybe",
  "may ",
  "probably",
  "possibly",
  "perhaps",
  "not sure",
  "unsure",
  "could",
  "considering",
  "planning to maybe",
  "i guess",
  "roughly",
  "or so",
  "some time",
  "sometime",
];

export function soundsUncertain(text: string): boolean {
  const input = ` ${text.toLowerCase()} `;
  return HEDGE_WORDS.some((word) => input.includes(word));
}

/* -------------------------------------------------------------------------- */
/*  Day part                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A time of day the sentence itself named, if any — "tonight", "this
 * afternoon", or a bare "morning"/"evening"/etc. Used to pick WHICH of a
 * person's several routines a sentence is about (see `assumedJourney`), not
 * to resolve a clock time — `parseTime` above still owns that.
 *
 * Phrases are checked before bare words so "tonight" reads as night rather
 * than a stray "morning" mentioned elsewhere in the same sentence winning by
 * accident, and so a phrase always beats a same-day-part bare word.
 */
export function extractDayPart(text: string): DayPart | undefined {
  const input = text.toLowerCase();

  if (/\b(tonight|this evening|late evening|in the evening)\b/.test(input)) return "evening";
  if (/\b(this morning|in the morning|early morning|first thing)\b/.test(input)) return "morning";
  if (/\b(this afternoon|in the afternoon)\b/.test(input)) return "afternoon";
  if (/\b(late at night|in the night|tonight late)\b/.test(input)) return "night";

  if (/\bmorning\b/.test(input)) return "morning";
  if (/\bafternoon\b/.test(input)) return "afternoon";
  if (/\bevening\b/.test(input)) return "evening";
  if (/\bnight\b/.test(input)) return "night";

  return undefined;
}
