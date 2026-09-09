/**
 * Small shared helpers used across the app.
 * Deliberately dependency-free so the bundle stays small.
 */

/**
 * Joins CSS class names together, skipping anything falsy.
 *
 * @example
 *   cn("btn", isActive && "btn-active", undefined) // -> "btn btn-active"
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Formats a 24-hour "HH:MM" string into a friendly 12-hour label.
 *
 * @example formatTimeLabel("08:45") // -> "8:45 AM"
 */
export function formatTimeLabel(time24: string): string {
  const [hourText, minuteText] = time24.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return time24;

  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const paddedMinute = String(minute).padStart(2, "0");

  return `${hour12}:${paddedMinute} ${period}`;
}

/**
 * Returns "Good morning" / "Good afternoon" / "Good evening" for a given hour.
 * Used to greet the user on the dashboard.
 */
export function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Type-safe "this should never happen" helper for exhaustive switch statements. */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
