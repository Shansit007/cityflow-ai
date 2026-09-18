"use client";

import { ChoiceGroup, Toggle } from "@/components/ui/choice-group";
import { TextField } from "@/components/ui/input";
import type { StepProps } from "@/components/onboarding/types";
import { WEEKDAYS, formatTime, toMinutes, toTimeString } from "@/lib/demand/time-slots";
import { FLEXIBILITY_OPTIONS } from "@/lib/travel";
import { cn } from "@/lib/utils";

/**
 * STEP 2 — the schedule.
 *
 * This is the step that makes the whole product possible. Two numbers matter
 * most:
 *   - the required arrival, which is the hard constraint the engine may never break
 *   - the flexibility window, which is the only room the engine has to work with
 *
 * The journey time is asked for rather than guessed. CityFlow AI has no live
 * route timing yet, and a made-up travel time would quietly corrupt every
 * arrival estimate shown later.
 */
export function StepSchedule({ draft, update, errors }: StepProps) {
  // A live preview of what the stated numbers actually mean, so mistakes are
  // obvious here rather than confusing on the dashboard later.
  const departureMinutes = toMinutes(draft.usualDeparture);
  const estimatedArrival =
    departureMinutes === null
      ? null
      : toTimeString(departureMinutes + draft.typicalJourneyMinutes);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Usual departure time"
          type="time"
          required
          value={draft.usualDeparture}
          onChange={(event) => update({ usualDeparture: event.target.value })}
          error={errors.usualDeparture}
          hint="When you normally set off."
        />

        <TextField
          label="You need to arrive by"
          type="time"
          required
          value={draft.requiredArrival}
          onChange={(event) => update({ requiredArrival: event.target.value })}
          error={errors.requiredArrival}
          hint="CityFlow AI will never suggest a time that misses this."
        />
      </div>

      <TextField
        label="How long does the trip normally take?"
        type="number"
        inputMode="numeric"
        min={1}
        max={300}
        required
        value={String(draft.typicalJourneyMinutes)}
        onChange={(event) =>
          update({ typicalJourneyMinutes: Number(event.target.value) || 0 })
        }
        error={errors.typicalJourneyMinutes}
        hint="In minutes, on a good day with light traffic."
      />

      {estimatedArrival && (
        <p className="rounded-lg bg-surface-2 p-3 text-sm text-muted">
          Leaving at <span className="font-medium text-fg">{formatTime(draft.usualDeparture)}</span>{" "}
          with a {draft.typicalJourneyMinutes}-minute journey means arriving around{" "}
          <span className="font-medium text-fg">{formatTime(estimatedArrival)}</span> in light
          traffic.
        </p>
      )}

      {/* ------------------------------------------------------ travel days */}
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-fg">
          Which days do you make this trip?
        </legend>
        <p className="mb-3 text-xs text-subtle">
          Recommendations are only generated for the days you select.
        </p>

        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => {
            const selected = draft.travelDays.includes(day.code);

            return (
              <label
                key={day.code}
                className={cn(
                  "cursor-pointer rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors",
                  selected
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border-base bg-surface text-muted hover:bg-surface-2"
                )}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() =>
                    update({
                      travelDays: selected
                        ? draft.travelDays.filter((code) => code !== day.code)
                        : [...draft.travelDays, day.code],
                    })
                  }
                  className="sr-only-cf"
                />
                <span className="sr-only-cf">{day.full}</span>
                <span aria-hidden="true">{day.label}</span>
              </label>
            );
          })}
        </div>

        {errors.travelDays && (
          <p role="alert" className="mt-2 text-xs font-medium text-danger">
            {errors.travelDays}
          </p>
        )}
      </fieldset>

      {/* ------------------------------------------------------- flexibility */}
      <Toggle
        label="My departure time can move a little"
        description="Without some flexibility CityFlow AI can show you the traffic picture, but it cannot suggest a better time."
        checked={draft.isFlexible}
        onChange={(checked) => update({ isFlexible: checked })}
      />

      {draft.isFlexible && (
        <ChoiceGroup
          legend="How much could it move?"
          description="The largest shift you would consider, in either direction."
          choices={FLEXIBILITY_OPTIONS.map((option) => ({
            value: String(option.minutes),
            label: option.label,
            hint: option.hint,
          }))}
          value={String(draft.flexibilityMinutes)}
          onChange={(value) => update({ flexibilityMinutes: Number(value) })}
          columns={3}
          error={errors.flexibilityMinutes}
        />
      )}
    </div>
  );
}
