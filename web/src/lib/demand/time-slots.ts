/**
 * Time-slot arithmetic.
 *
 * CityFlow AI reasons about the day in 15-minute slots. That granularity is a
 * deliberate compromise: fine enough that "leave at 8:45 instead of 9:00" is a
 * meaningful suggestion, coarse enough that aggregated demand per slot is a
 * stable number rather than noise.
 *
 * Times of day are handled as plain "HH:MM" strings and as "minutes since
 * midnight" integers. Neither is a Date, on purpose — "09:00 every weekday" is
 * a recurring wall-clock time, not a moment on a calendar, and storing it as a
 * Date invites timezone bugs.
 */

/** Length of one demand slot, in minutes. */
export const SLOT_MINUTES = 15;

/** Number of slots in a full day. */
export const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES;

/**
 * "08:45" -> 525
 * Returns null for anything that is not a valid 24-hour time.
 */
export function toMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
}

/** 525 -> "08:45". Wraps around midnight so arithmetic can never produce "25:10". */
export function toTimeString(minutesSinceMidnight: number): string {
  const wrapped = ((minutesSinceMidnight % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Rounds a time down to the start of its 15-minute slot. 08:52 -> 08:45. */
export function floorToSlot(minutesSinceMidnight: number): number {
  return Math.floor(minutesSinceMidnight / SLOT_MINUTES) * SLOT_MINUTES;
}

/** Rounds a time to the NEAREST slot. 08:52 -> 08:45, 08:53 -> 09:00. */
export function roundToSlot(minutesSinceMidnight: number): number {
  return Math.round(minutesSinceMidnight / SLOT_MINUTES) * SLOT_MINUTES;
}

/**
 * Every slot start between two times, inclusive of both ends.
 * Returns an empty array if `to` is before `from`.
 */
export function slotRange(fromMinutes: number, toMinutes_: number): number[] {
  const start = floorToSlot(fromMinutes);
  const end = floorToSlot(toMinutes_);

  if (end < start) return [];

  const slots: number[] = [];
  for (let slot = start; slot <= end; slot += SLOT_MINUTES) {
    slots.push(slot);
  }

  return slots;
}

/**
 * "08:45" -> "8:45 AM".
 * Indian public services commonly use the 12-hour clock in conversation, so
 * this is what the interface shows even though we store 24-hour internally.
 */
export function formatSlotLabel(minutesSinceMidnight: number): string {
  const wrapped = ((minutesSinceMidnight % 1440) + 1440) % 1440;
  const hours24 = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;

  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
}

/** Formats a "HH:MM" string for display. Falls back to the raw value if invalid. */
export function formatTime(time: string): string {
  const minutes = toMinutes(time);
  return minutes === null ? time : formatSlotLabel(minutes);
}

/** "35 min" / "1 hr 20 min" — used for journey durations. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/** Days of the week, in the order Indian schedules are usually written. */
export const WEEKDAYS = [
  { code: "MON", label: "Mon", full: "Monday" },
  { code: "TUE", label: "Tue", full: "Tuesday" },
  { code: "WED", label: "Wed", full: "Wednesday" },
  { code: "THU", label: "Thu", full: "Thursday" },
  { code: "FRI", label: "Fri", full: "Friday" },
  { code: "SAT", label: "Sat", full: "Saturday" },
  { code: "SUN", label: "Sun", full: "Sunday" },
] as const;

export type DayCode = (typeof WEEKDAYS)[number]["code"];

/** JavaScript's getDay() (0 = Sunday) mapped to our day codes. */
const DAY_CODE_BY_INDEX: DayCode[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/** Returns the day code for a date, e.g. "TUE". */
export function dayCodeFor(date: Date): DayCode {
  return DAY_CODE_BY_INDEX[date.getDay()];
}

/** True for Saturday and Sunday. */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}
