import Link from "next/link";

import { Card, CardHeader } from "@/components/ui/card";

/**
 * Profile completeness.
 *
 * WHAT THIS IS ACTUALLY FOR
 * Onboarding makes the essential fields compulsory, so every profile is
 * "complete" in the sense of being valid. What varies is how much CityFlow AI
 * can do with it — a person who never confirms a plan gets recommendations
 * built purely on their stated routine, and a person whose journey time is a
 * rough guess gets arrival estimates that are rough guesses too.
 *
 * So this is not a progress bar chasing 100% for its own sake. Each item says
 * what it changes about the answers the person gets, and an item they have
 * deliberately declined — notifications off, demand sharing off — is shown as a
 * respected choice, never as something missing. Nagging somebody about a
 * privacy setting they chose on purpose would be a dark pattern.
 */

export interface CompletenessInput {
  hasDisplayName: boolean;
  hasCity: boolean;
  isFlexible: boolean;
  hasConfirmedPlan: boolean;
  hasPreferredModes: boolean;
  sharesDemand: boolean;
  allowsNotifications: boolean;
}

interface Item {
  label: string;
  done: boolean;
  /** What this changes about the recommendations they get. */
  effect: string;
  href?: string;
  /** A deliberate choice rather than an omission. */
  choice?: boolean;
}

export function ProfileCompleteness(input: CompletenessInput) {
  const items: Item[] = [
    {
      label: "Travel routine set up",
      done: true,
      effect: "This is what every departure recommendation is calculated from.",
    },
    {
      label: "City selected",
      done: input.hasCity,
      effect: "Demand figures and the map are city-specific.",
      href: "/profile",
    },
    {
      label: "Display name added",
      done: input.hasDisplayName,
      effect: "Only used to greet you. Nothing else depends on it.",
    },
    {
      label: "Departure flexibility set",
      done: input.isFlexible,
      effect: input.isFlexible
        ? "CityFlow AI can suggest a quieter time within the range you allowed."
        : "You said your departure cannot move, so CityFlow AI shows demand but never suggests a different time. That is respected.",
      choice: !input.isFlexible,
    },
    {
      label: "Alternative travel modes chosen",
      done: input.hasPreferredModes,
      effect: "Lets CityFlow AI mention an option that avoids road congestion entirely.",
      href: "/profile",
    },
    {
      label: "A travel plan confirmed",
      done: input.hasConfirmedPlan,
      effect: input.hasConfirmedPlan
        ? "Your confirmed plans are what let other people's recommendations take you into account."
        : "Confirming when you are actually leaving is what puts your trip into the city's demand picture. Without it, the system only has your usual time.",
      href: "/assistant",
    },
    {
      label: "Counted in city demand totals",
      done: input.sharesDemand,
      effect: input.sharesDemand
        ? "Your trips are included, anonymously, in city-level planning figures."
        : "You switched this off. Your trips are excluded from every city figure and every export — your choice, respected everywhere.",
      choice: !input.sharesDemand,
    },
    {
      label: "Notifications allowed",
      done: input.allowsNotifications,
      effect: input.allowsNotifications
        ? "You will be told when your recommended time changes."
        : "You switched this off, so changes appear on the dashboard but nothing will alert you.",
      choice: !input.allowsNotifications,
    },
  ];

  // Deliberate choices are excluded from the score — a respected preference is
  // not an incomplete profile.
  const scored = items.filter((item) => !item.choice);
  const done = scored.filter((item) => item.done).length;

  return (
    <Card>
      <CardHeader
        title="How much CityFlow AI can do for you"
        description={`${done} of ${scored.length} things that improve your recommendations are in place.`}
      />

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.label} className="flex gap-3">
            <StatusMark done={item.done} choice={item.choice} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg">
                {item.label}
                {item.choice && (
                  <span className="ml-2 text-xs font-normal text-subtle">your choice</span>
                )}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                {item.effect}
                {!item.done && !item.choice && item.href && (
                  <>
                    {" "}
                    <Link
                      href={item.href}
                      className="font-medium text-primary underline underline-offset-2"
                    >
                      Set this up
                    </Link>
                  </>
                )}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * The marker.
 *
 * Three states, each with its own SHAPE as well as its own colour — a tick, a
 * dash for a deliberate choice, and an empty circle for something not done —
 * plus a screen-reader word, so none of this depends on seeing colour.
 */
function StatusMark({ done, choice }: { done: boolean; choice?: boolean }) {
  if (choice) {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-2 text-xs font-semibold text-muted">
        <span className="sr-only-cf">Your choice:</span>
        <span aria-hidden="true">–</span>
      </span>
    );
  }

  if (done) {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-traffic-low-soft text-traffic-low">
        <span className="sr-only-cf">Done:</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m5 13 4 4L19 7" />
        </svg>
      </span>
    );
  }

  return (
    <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-dashed border-border-strong">
      <span className="sr-only-cf">Not set up yet:</span>
    </span>
  );
}
