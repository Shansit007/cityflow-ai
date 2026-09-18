"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useCity } from "@/components/city/city-provider";
import { ONBOARDING_STEPS, Stepper } from "@/components/onboarding/stepper";
import { StepJourney } from "@/components/onboarding/step-journey";
import { StepPreferences } from "@/components/onboarding/step-preferences";
import { StepPrivacy } from "@/components/onboarding/step-privacy";
import { StepSchedule } from "@/components/onboarding/step-schedule";
import { DEFAULT_DRAFT } from "@/components/onboarding/types";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/input";
import { fieldErrorsFrom, travelProfileSchema, type TravelProfileInput } from "@/lib/validation";

/**
 * The four-step onboarding flow.
 *
 * DESIGN DECISIONS
 *  - One draft object, four views onto it. Going back never loses anything.
 *  - Validation uses the SAME schema the server uses, so a step can never be
 *    passed on the client and then rejected on the server.
 *  - "Next" only blocks on problems belonging to the CURRENT step. A missing
 *    value on step 3 must not stop someone finishing step 1.
 */

/** Which fields each step is responsible for, used to scope "Next" validation. */
const STEP_FIELDS: string[][] = [
  ["homeArea", "destinationArea", "destinationType", "primaryMode"],
  [
    "usualDeparture",
    "requiredArrival",
    "typicalJourneyMinutes",
    "travelDays",
    "isFlexible",
    "flexibilityMinutes",
  ],
  [
    "preferredModes",
    "maxAcceptableDelayMinutes",
    "willingToLeaveEarlier",
    "willingToLeaveLater",
    "carpoolInterest",
    "publicTransportInterest",
  ],
  ["shareAggregatedDemand", "allowNotifications"],
];

export function OnboardingFlow() {
  const router = useRouter();
  const { cityCode, city } = useCity();

  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<TravelProfileInput>(DEFAULT_DRAFT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isLastStep = stepIndex === ONBOARDING_STEPS.length - 1;

  const stepProps = useMemo(
    () => ({
      draft,
      update: (patch: Partial<TravelProfileInput>) => {
        setDraft((current) => ({ ...current, ...patch }));
        // Clear the messages for the fields the person is actively fixing.
        setErrors((current) => {
          const next = { ...current };
          for (const key of Object.keys(patch)) delete next[key];
          return next;
        });
      },
      errors,
    }),
    [draft, errors]
  );

  /** Validates the whole draft, but only reports problems on the current step. */
  function validateCurrentStep(): boolean {
    const parsed = travelProfileSchema.safeParse(draft);
    if (parsed.success) {
      setErrors({});
      return true;
    }

    const allErrors = fieldErrorsFrom(parsed.error);
    const relevant: Record<string, string> = {};

    for (const field of STEP_FIELDS[stepIndex]) {
      if (allErrors[field]) relevant[field] = allErrors[field];
    }

    setErrors(relevant);
    return Object.keys(relevant).length === 0;
  }

  function handleNext() {
    if (!validateCurrentStep()) return;
    setStepIndex((index) => Math.min(index + 1, ONBOARDING_STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBack() {
    setFormError(null);
    setStepIndex((index) => Math.max(index - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    setFormError(null);

    // Final check against the complete schema, not just this step.
    const parsed = travelProfileSchema.safeParse(draft);
    if (!parsed.success) {
      const allErrors = fieldErrorsFrom(parsed.error);
      setErrors(allErrors);

      // Jump back to the earliest step that has a problem, so the person can
      // actually see what needs fixing.
      const firstBadStep = STEP_FIELDS.findIndex((fields) =>
        fields.some((field) => allErrors[field])
      );
      if (firstBadStep >= 0) setStepIndex(firstBadStep);

      setFormError("Some details need checking before we can save your routine.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed.data, cityCode }),
      });

      const result = await response.json();

      if (!response.ok) {
        setFormError(result.error ?? "We could not save your routine. Please try again.");
        if (result.fieldErrors) setErrors(result.fieldErrors);
        return;
      }

      router.push("/dashboard?welcome=1");
      router.refresh();
    } catch {
      setFormError(
        "Could not reach the server. Please check your internet connection and try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-card border border-border-base bg-surface p-5 shadow-card sm:p-8">
      <Stepper current={stepIndex} />

      <div className="mt-8">
        <h2 className="text-xl font-semibold text-fg">{ONBOARDING_STEPS[stepIndex].title}</h2>
        <p className="mt-1 text-sm text-muted">
          {ONBOARDING_STEPS[stepIndex].subtitle} · {city.name}
        </p>

        <div className="mt-6">
          {stepIndex === 0 && <StepJourney {...stepProps} />}
          {stepIndex === 1 && <StepSchedule {...stepProps} />}
          {stepIndex === 2 && <StepPreferences {...stepProps} />}
          {stepIndex === 3 && <StepPrivacy {...stepProps} />}
        </div>
      </div>

      {formError && (
        <div className="mt-6">
          <Notice tone="error">{formError}</Notice>
        </div>
      )}

      {/* ------------------------------------------------------- navigation */}
      <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border-base pt-6 sm:flex-row sm:justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={stepIndex === 0 || saving}
          type="button"
        >
          Back
        </Button>

        {isLastStep ? (
          <Button onClick={handleSubmit} loading={saving} size="lg" type="button">
            Complete Setup
          </Button>
        ) : (
          <Button onClick={handleNext} size="lg" type="button">
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}
