"use client";

import { ChoiceGroup, MultiChoiceGroup, Toggle } from "@/components/ui/choice-group";
import type { StepProps } from "@/components/onboarding/types";
import { MAX_DELAY_OPTIONS, TRANSPORT_MODES } from "@/lib/travel";

/**
 * STEP 3 — preferences.
 *
 * Everything here narrows what the engine is allowed to suggest. A person who
 * says they cannot leave earlier will never be told to leave earlier, no matter
 * how quiet 7:30 looks. Constraints are respected, not negotiated.
 */
export function StepPreferences({ draft, update, errors }: StepProps) {
  return (
    <div className="space-y-6">
      <MultiChoiceGroup
        legend="Other ways you would be willing to travel"
        description="Optional. This does not change your usual mode — it tells CityFlow AI which alternatives are worth showing you."
        choices={TRANSPORT_MODES.filter((mode) => mode.code !== draft.primaryMode).map(
          (mode) => ({ value: mode.code, label: mode.label, hint: mode.hint })
        )}
        values={draft.preferredModes}
        onChange={(values) => update({ preferredModes: values })}
        error={errors.preferredModes}
      />

      <ChoiceGroup
        legend="How much extra delay could you accept?"
        description="Compared with your normal arrival time."
        choices={MAX_DELAY_OPTIONS.map((option) => ({
          value: String(option.minutes),
          label: option.label,
        }))}
        value={String(draft.maxAcceptableDelayMinutes)}
        onChange={(value) => update({ maxAcceptableDelayMinutes: Number(value) })}
        columns={3}
        error={errors.maxAcceptableDelayMinutes}
      />

      <div className="space-y-3">
        <p className="text-sm font-medium text-fg">Which direction can your departure move?</p>

        <Toggle
          label="I could leave earlier than usual"
          description="Lets CityFlow AI suggest a time before your normal departure."
          checked={draft.willingToLeaveEarlier}
          onChange={(checked) => update({ willingToLeaveEarlier: checked })}
        />

        <Toggle
          label="I could leave later than usual"
          description="Only ever suggested when you would still arrive within your required time."
          checked={draft.willingToLeaveLater}
          onChange={(checked) => update({ willingToLeaveLater: checked })}
        />

        {errors.willingToLeaveEarlier && (
          <p role="alert" className="text-xs font-medium text-danger">
            {errors.willingToLeaveEarlier}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-fg">Are you open to sharing the road less?</p>

        <Toggle
          label="Interested in carpooling"
          description="Fewer vehicles for the same number of people is the most direct way to reduce a peak."
          checked={draft.carpoolInterest}
          onChange={(checked) => update({ carpoolInterest: checked })}
        />

        <Toggle
          label="Interested in public transport"
          description="Metro and rail trips do not use road capacity at all."
          checked={draft.publicTransportInterest}
          onChange={(checked) => update({ publicTransportInterest: checked })}
        />
      </div>

      <p className="text-xs leading-relaxed text-subtle">
        Carpooling and public-transport matching are not built yet. Recording your interest
        now simply means CityFlow AI can show you relevant options when they exist — nothing
        is arranged on your behalf.
      </p>
    </div>
  );
}
