/**
 * How a defect is labelled for the queue, from how many independent travellers
 * registered it.
 *
 * Confirmation is a count, not a severity. The detector's severity says how hard the
 * jolt was, which is evidence about one hole; the count says how many separate people
 * hit it, which is what makes a report worth sending a crew to. A head of road
 * maintenance sets the threshold against the crews they have this month, so both
 * labels move when the threshold does and neither is stored on the row.
 *
 * Free of any database import so the dashboard and the server share one definition.
 */

export type Confirmation = "Confirmed" | "Under Review";
export type Priority = "Critical" | "High" | "Medium" | "Review";

export const CRITICAL_CONFIRMATIONS = 100;
export const HIGH_CONFIRMATIONS = 50;

export function confirmationOf(confirmations: number, threshold: number): Confirmation {
  return confirmations >= threshold ? "Confirmed" : "Under Review";
}

/**
 * The bands stay ordered when the threshold is raised above them: a head who decides
 * nothing under 200 confirmations is worth a visit should not then find everything
 * labelled Critical, so each band is at least the threshold.
 */
export function priorityOf(confirmations: number, threshold: number): Priority {
  if (confirmations >= Math.max(CRITICAL_CONFIRMATIONS, threshold)) return "Critical";
  if (confirmations >= Math.max(HIGH_CONFIRMATIONS, threshold)) return "High";
  if (confirmations >= threshold) return "Medium";
  return "Review";
}

export const PRIORITY_ORDER: readonly Priority[] = [
  "Critical",
  "High",
  "Medium",
  "Review",
];
