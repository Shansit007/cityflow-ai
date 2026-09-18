/**
 * "What day and time is it, for this user?"
 *
 * THE PROBLEM THIS SOLVES
 * The server runs in UTC (Vercel does), but CityFlow AI is a service for Indian
 * cities. At 2:00 AM in Kolkata it is still the previous day in UTC. If we used
 * the server's own clock, a person opening the app late at night would get
 * yesterday's recommendation, and their travel history would be off by a day.
 *
 * So every "today" and "now" in the product goes through this file, which reads
 * the clock in the application's timezone rather than the server's.
 */

/** The timezone CityFlow AI reasons in. */
export const APP_TIMEZONE = "Asia/Kolkata";

/** A readable name for the UI, so the user knows which clock we mean. */
export const APP_TIMEZONE_LABEL = "IST";

interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
}

/** Reads the wall-clock time in the application timezone. */
function readLocalParts(now: Date): LocalParts {
  // "en-CA" gives ISO-ish ordering, which makes the parts easy to read back.
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    // Some runtimes render midnight as "24"; normalise it.
    hour: read("hour") % 24,
    minute: read("minute"),
  };
}

/**
 * A Date whose LOCAL fields (getDay, getFullYear…) match the wall clock in the
 * application timezone.
 *
 * This is what the demand model receives. It only ever asks the date for its
 * day-of-week and its calendar date, so this representation is exactly right —
 * and it keeps the model free of timezone handling.
 */
export function appLocalDate(now: Date = new Date()): Date {
  const { year, month, day, hour, minute } = readLocalParts(now);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

/** "2026-09-09" for the application timezone. */
export function appDateKey(now: Date = new Date()): string {
  const { year, month, day } = readLocalParts(now);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Midnight UTC of the application-timezone date.
 *
 * This is what goes into a Prisma `@db.Date` column: a date column stores no
 * time or offset, so anchoring it at UTC midnight keeps it stable no matter
 * where it is read back.
 */
export function appDateOnly(now: Date = new Date()): Date {
  const { year, month, day } = readLocalParts(now);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Minutes since midnight, in the application timezone. */
export function appMinutesSinceMidnight(now: Date = new Date()): number {
  const { hour, minute } = readLocalParts(now);
  return hour * 60 + minute;
}

/** The hour of day (0-23) in the application timezone — used for greetings. */
export function appHour(now: Date = new Date()): number {
  return readLocalParts(now).hour;
}

/** "Tuesday, 9 September" — used as the dashboard's date line. */
export function formatAppDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: APP_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
}
