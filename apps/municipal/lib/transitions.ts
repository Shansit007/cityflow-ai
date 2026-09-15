import type { Role } from "./session";

export const DEFECT_STATUSES = [
  "reported",
  "triaged",
  "assigned",
  "in_progress",
  "resolved",
  "rejected",
] as const;

export type DefectStatus = (typeof DEFECT_STATUSES)[number];

export const STATUS_LABELS: Record<DefectStatus, string> = {
  reported: "Reported",
  triaged: "Triaged",
  assigned: "Assigned",
  in_progress: "In progress",
  resolved: "Resolved",
  rejected: "Rejected",
};

/**
 * Where a defect may go next, and who may take it there.
 *
 * No entry moves backwards. Reopening a defect is a new report by new travellers
 * hitting the same hole, not an edit to the row that says it was fixed, which is what
 * keeps median time-to-resolve from being quietly rewritten after the fact.
 *
 * Kept free of any database import so the dashboard can render the same rules it
 * enforces. The server checks them again on every request regardless: this module
 * decides which buttons to draw, not who is allowed to do what.
 */
const TRANSITIONS: Record<DefectStatus, readonly DefectStatus[]> = {
  reported: ["triaged", "rejected"],
  triaged: ["rejected"],
  assigned: ["in_progress", "rejected"],
  in_progress: ["resolved"],
  resolved: [],
  rejected: [],
};

const HEAD_ONLY: readonly DefectStatus[] = ["triaged", "rejected"];

export function allowedTransitions(role: Role, from: DefectStatus): DefectStatus[] {
  return TRANSITIONS[from].filter((to) => role === "head" || !HEAD_ONLY.includes(to));
}

export function statusesLeadingTo(role: Role, to: DefectStatus): DefectStatus[] {
  return DEFECT_STATUSES.filter((from) => allowedTransitions(role, from).includes(to));
}

export class TransitionRefused extends Error {}
