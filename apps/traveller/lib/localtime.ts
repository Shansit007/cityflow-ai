/**
 * India has one time zone, and every city in `cities.ts` is in it. Kept as a named
 * constant rather than a per-city field so that adding a city outside it is a
 * compile-time decision rather than a silent hour's error in someone's departure.
 */
export const INDIA_TIME_ZONE = "Asia/Kolkata";

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  /** 0 is Sunday, matching the routines.days_of_week convention. */
  weekday: number;
}

const PART_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: INDIA_TIME_ZONE,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Piece = "year" | "month" | "day" | "hour" | "minute" | "second" | "weekday";

/**
 * Intl always emits every field asked for, but the type system cannot know that, and
 * a missing one silently becoming zero would be an hour's error in someone's
 * departure rather than a visible failure.
 */
function parts(instant: Date): Record<Piece, string> {
  const found = new Map(
    PART_FORMAT.formatToParts(instant).map((part) => [part.type, part.value]),
  );

  const read = (piece: Piece): string => {
    const value = found.get(piece);
    if (value === undefined) {
      throw new Error(`Intl did not return ${piece} for ${INDIA_TIME_ZONE}.`);
    }
    return value;
  };

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
    weekday: read("weekday"),
  };
}

/** The calendar day it currently is in the city, which is not always the server's. */
export function zonedToday(now: Date = new Date()): ZonedParts {
  const local = parts(now);
  return {
    year: Number(local.year),
    month: Number(local.month),
    day: Number(local.day),
    weekday: WEEKDAYS.indexOf(local.weekday),
  };
}

/**
 * The instant at which a wall-clock time falls on a given local day.
 *
 * A routine stores "arrive by 09:30" with no date and no offset, so turning it into
 * something the engine can plan against means asking what 09:30 in the city is in UTC.
 * The offset is measured at a guess and then applied, rather than hard-coded, because
 * a fixed +05:30 is a bug waiting for the first city that does not use it.
 */
export function instantFor(day: ZonedParts, clockTime: string): Date {
  const [hours = 0, minutes = 0] = clockTime.split(":").map(Number);
  const guess = Date.UTC(day.year, day.month - 1, day.day, hours, minutes);
  const local = parts(new Date(guess));

  const asIfUtc = Date.UTC(
    Number(local.year),
    Number(local.month) - 1,
    Number(local.day),
    Number(local.hour) % 24,
    Number(local.minute),
    Number(local.second),
  );

  return new Date(guess - (asIfUtc - guess));
}

const CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: INDIA_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function clock(instant: Date): string {
  return CLOCK.format(instant);
}
