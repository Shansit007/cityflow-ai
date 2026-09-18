"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useCity } from "@/components/city/city-provider";
import { StepJourney } from "@/components/onboarding/step-journey";
import { StepPreferences } from "@/components/onboarding/step-preferences";
import { StepPrivacy } from "@/components/onboarding/step-privacy";
import { StepSchedule } from "@/components/onboarding/step-schedule";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/input";
import {
  fieldErrorsFrom,
  travelProfileSchema,
  type TravelProfileInput,
} from "@/lib/validation";

/**
 * The profile editor.
 *
 * It reuses the EXACT same four step components as onboarding, just stacked
 * into one scrollable page instead of a wizard. That is the whole point: there
 * is one definition of "your travel routine" in the product, so the two screens
 * can never drift apart, validate differently, or offer different options.
 */

interface ProfileFormProps {
  /** The user's saved routine, already converted to the form's shape. */
  initial: TravelProfileInput;
}

const SECTIONS = [
  { title: "Your journey", subtitle: "Where you travel" },
  { title: "Your schedule", subtitle: "When you travel" },
  { title: "Preferences", subtitle: "What you are open to" },
  { title: "Privacy", subtitle: "What CityFlow AI stores" },
] as const;

export function ProfileForm({ initial }: ProfileFormProps) {
  const router = useRouter();
  const { cityCode } = useCity();

  const [draft, setDraft] = useState<TravelProfileInput>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  /** True once the person has changed something — enables the Save button. */
  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initial),
    [draft, initial]
  );

  const stepProps = useMemo(
    () => ({
      draft,
      update: (patch: Partial<TravelProfileInput>) => {
        setSaved(false);
        setDraft((current) => ({ ...current, ...patch }));
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

  async function handleSave() {
    setFormError(null);
    setSaved(false);

    const parsed = travelProfileSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      setFormError("Some details need checking before your routine can be saved.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setErrors({});
    setSaving(true);

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed.data, cityCode }),
      });

      const result = await response.json();

      if (!response.ok) {
        setFormError(result.error ?? "We could not save your changes. Please try again.");
        if (result.fieldErrors) setErrors(result.fieldErrors);
        return;
      }

      setSaved(true);
      // Re-runs the dashboard's server components so today's recommendation is
      // recalculated against the routine that was just saved.
      router.refresh();
    } catch {
      setFormError("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {formError && <Notice tone="error">{formError}</Notice>}
      {saved && (
        <Notice tone="success">
          Your routine has been saved. Today&apos;s recommendation has been recalculated.
        </Notice>
      )}

      {SECTIONS.map((section, index) => (
        <Card key={section.title}>
          <div className="mb-6 border-b border-border-base pb-4">
            <h2 className="text-lg font-semibold text-fg">{section.title}</h2>
            <p className="mt-1 text-sm text-muted">{section.subtitle}</p>
          </div>

          {index === 0 && <StepJourney {...stepProps} />}
          {index === 1 && <StepSchedule {...stepProps} />}
          {index === 2 && <StepPreferences {...stepProps} />}
          {index === 3 && <StepPrivacy {...stepProps} />}
        </Card>
      ))}

      {/*
        Sticky save bar. On a long form the button must stay reachable — asking
        someone to scroll to the bottom to save a change made at the top is a
        reliable way to lose their edit.
      */}
      <div className="sticky bottom-4 z-30 rounded-card border border-border-base bg-surface p-4 shadow-float">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {isDirty ? "You have unsaved changes." : "Everything is saved."}
          </p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDraft(initial);
                setErrors({});
                setFormError(null);
                setSaved(false);
              }}
              disabled={!isDirty || saving}
            >
              Undo changes
            </Button>

            <Button onClick={handleSave} loading={saving} disabled={!isDirty}>
              Save routine
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
