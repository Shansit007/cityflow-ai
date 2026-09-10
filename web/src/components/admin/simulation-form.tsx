"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ChoiceGroup } from "@/components/ui/choice-group";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice, TextField } from "@/components/ui/input";
import type { CityCode } from "@/lib/cities";
import { fieldErrorsFrom, simulationRunSchema } from "@/lib/validation";

/**
 * Recording the result of a SUMO run.
 *
 * This is an INPUT FORM, not a "run simulation" button, and the difference
 * matters. CityFlow AI cannot run SUMO — it is a desktop simulator. A button
 * that appeared to run one and produced numbers would be fabricating the single
 * most important evidence in the project.
 *
 * So the loop is explicit and visible: export demand, run it yourself, type the
 * results back in. Every stored figure came from a real run someone carried out.
 */

interface SimulationFormProps {
  cityCode: CityCode;
}

const EMPTY = {
  scenario: "BASELINE" as "BASELINE" | "CITYFLOW",
  networkSource: "",
  vehiclesDeparted: "",
  meanTravelTimeSeconds: "",
  totalDelaySeconds: "",
  peakSlotVehicles: "",
  meanWaitingSeconds: "",
  notes: "",
};

export function SimulationForm({ cityCode }: SimulationFormProps) {
  const router = useRouter();

  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  function update(patch: Partial<typeof EMPTY>) {
    setSaved(false);
    setValues((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSaved(false);

    // Numbers arrive from the form as strings; the schema wants numbers.
    const payload = {
      cityCode,
      scenario: values.scenario,
      networkSource: values.networkSource,
      vehiclesDeparted: Number(values.vehiclesDeparted),
      meanTravelTimeSeconds: Number(values.meanTravelTimeSeconds),
      totalDelaySeconds: Number(values.totalDelaySeconds),
      peakSlotVehicles: Number(values.peakSlotVehicles),
      meanWaitingSeconds: Number(values.meanWaitingSeconds),
      notes: values.notes,
    };

    const parsed = simulationRunSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      setFormError("Please check the highlighted fields.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/simulation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const data = await response.json();

      if (!response.ok) {
        setFormError(data.error ?? "Could not save that run.");
        if (data.fieldErrors) setErrors(data.fieldErrors);
        return;
      }

      setValues(EMPTY);
      setSaved(true);
      router.refresh();
    } catch {
      setFormError("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Record a simulation result"
        description="Paste the metrics from a completed SUMO run. Nothing here is generated."
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {formError && <Notice tone="error">{formError}</Notice>}
        {saved && (
          <Notice tone="success">
            Run recorded. It appears in the comparison below.
          </Notice>
        )}

        <ChoiceGroup
          legend="Scenario"
          description="Which of the two exports produced this run."
          choices={[
            {
              value: "BASELINE",
              label: "Baseline",
              hint: "Everyone departs at their normal time",
            },
            {
              value: "CITYFLOW",
              label: "CityFlow AI",
              hint: "Departures follow the recommendations",
            },
          ]}
          value={values.scenario}
          onChange={(value) => update({ scenario: value as "BASELINE" | "CITYFLOW" })}
          error={errors.scenario}
        />

        <TextField
          label="Road network source"
          required
          value={values.networkSource}
          onChange={(event) => update({ networkSource: event.target.value })}
          error={errors.networkSource}
          placeholder="e.g. OpenStreetMap extract, 2026-09-01, netconvert 1.19"
          hint="Two runs are only comparable if they used the same network. Say which one."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Vehicles departed"
            type="number"
            inputMode="numeric"
            min={0}
            required
            value={values.vehiclesDeparted}
            onChange={(event) => update({ vehiclesDeparted: event.target.value })}
            error={errors.vehiclesDeparted}
            hint="SUMO summary output: departed"
          />

          <TextField
            label="Mean travel time (seconds)"
            type="number"
            inputMode="numeric"
            min={0}
            required
            value={values.meanTravelTimeSeconds}
            onChange={(event) => update({ meanTravelTimeSeconds: event.target.value })}
            error={errors.meanTravelTimeSeconds}
            hint="tripinfo output: mean duration"
          />

          <TextField
            label="Total delay (seconds)"
            type="number"
            inputMode="numeric"
            min={0}
            required
            value={values.totalDelaySeconds}
            onChange={(event) => update({ totalDelaySeconds: event.target.value })}
            error={errors.totalDelaySeconds}
            hint="tripinfo output: sum of timeLoss"
          />

          <TextField
            label="Mean waiting time (seconds)"
            type="number"
            inputMode="numeric"
            min={0}
            required
            value={values.meanWaitingSeconds}
            onChange={(event) => update({ meanWaitingSeconds: event.target.value })}
            error={errors.meanWaitingSeconds}
            hint="tripinfo output: mean waitingTime"
          />

          <TextField
            label="Busiest 15-minute slot (vehicles)"
            type="number"
            inputMode="numeric"
            min={0}
            required
            value={values.peakSlotVehicles}
            onChange={(event) => update({ peakSlotVehicles: event.target.value })}
            error={errors.peakSlotVehicles}
            hint="The peak this run produced — the number demand smoothing is meant to lower"
          />
        </div>

        <TextField
          label="Notes"
          value={values.notes}
          onChange={(event) => update({ notes: event.target.value })}
          error={errors.notes}
          hint="Optional. Anything about how the run was configured."
        />

        <Button type="submit" loading={saving} size="lg">
          Record this run
        </Button>
      </form>
    </Card>
  );
}
