"use client";

import { useCity } from "@/components/city/city-provider";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { TextField } from "@/components/ui/input";
import type { StepProps } from "@/components/onboarding/types";
import { DESTINATION_TYPES, TRANSPORT_MODES } from "@/lib/travel";

/**
 * STEP 1 — the journey.
 *
 * Asks for AREAS, not addresses. An area is all the demand model needs to place
 * a trip on the network, and asking for less is the whole point of the privacy
 * model: we cannot leak a home address we never collected.
 */
export function StepJourney({ draft, update, errors }: StepProps) {
  const { city } = useCity();

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border-base bg-surface-2 p-4">
        <p className="text-sm leading-relaxed text-muted">
          Enter the <span className="font-medium text-fg">area</span> you travel from and to
          in {city.name} — not your full address. An area is enough for CityFlow AI to
          understand travel demand, and it keeps your exact location out of the system.
        </p>
      </div>

      <TextField
        label="Home area"
        required
        value={draft.homeArea}
        onChange={(event) => update({ homeArea: event.target.value })}
        error={errors.homeArea}
        placeholder="e.g. Salt Lake Sector 5"
        hint="The neighbourhood or locality you usually start from."
      />

      <TextField
        label="Where you travel to"
        required
        value={draft.destinationArea}
        onChange={(event) => update({ destinationArea: event.target.value })}
        error={errors.destinationArea}
        placeholder="e.g. Park Street"
        hint="The area of your office, college or usual destination."
      />

      <ChoiceGroup
        legend="What is your destination?"
        choices={DESTINATION_TYPES.map((type) => ({
          value: type.code,
          label: type.label,
        }))}
        value={draft.destinationType}
        onChange={(value) => update({ destinationType: value })}
        error={errors.destinationType}
      />

      <ChoiceGroup
        legend="How do you usually travel?"
        description="Your main mode on a normal day. You can list others you are open to in the next steps."
        choices={TRANSPORT_MODES.map((mode) => ({
          value: mode.code,
          label: mode.label,
          hint: mode.hint,
        }))}
        value={draft.primaryMode}
        onChange={(value) => update({ primaryMode: value })}
        error={errors.primaryMode}
        columns={2}
      />
    </div>
  );
}
