import type { TravelProfileInput } from "@/lib/validation";

/**
 * Shared shape for every onboarding step.
 *
 * All four steps edit ONE draft object rather than keeping their own state.
 * That is what lets the user move backwards and forwards without losing
 * anything, and it means the final submit sends exactly what was on screen.
 */
export interface StepProps {
  draft: TravelProfileInput;
  /** Merges a partial change into the draft. */
  update: (patch: Partial<TravelProfileInput>) => void;
  /** Field-level messages, keyed by field name. */
  errors: Record<string, string>;
}

/**
 * A sensible starting point, so the form is never an intimidating blank page.
 * Every value here is something the person can change; nothing is assumed
 * silently in the background.
 */
export const DEFAULT_DRAFT: TravelProfileInput = {
  homeArea: "",
  destinationArea: "",
  destinationType: "WORK",
  primaryMode: "CAR",

  usualDeparture: "09:00",
  requiredArrival: "09:30",
  typicalJourneyMinutes: 20,
  travelDays: ["MON", "TUE", "WED", "THU", "FRI"],
  isFlexible: true,
  flexibilityMinutes: 30,

  preferredModes: [],
  maxAcceptableDelayMinutes: 15,
  willingToLeaveEarlier: true,
  willingToLeaveLater: false,

  carpoolInterest: false,
  publicTransportInterest: false,

  shareAggregatedDemand: true,
  allowNotifications: true,
};
