"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { PhotoInput } from "@/components/roads/photo-input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { Notice, TextField } from "@/components/ui/input";
import { isPlausibleCoordinate } from "@/lib/roads/cell";
import { ROAD_ISSUE_SEVERITIES, ROAD_ISSUE_TYPES } from "@/lib/roads/types";
import type { RoadIssueSeverity, RoadIssueType } from "@/lib/roads/types";

/**
 * "Report a road issue" — the citizen reporting form.
 *
 * DESIGN NOTES
 * The area is pre-filled from the person's routine, because in the common case
 * they are reporting a road they travel every day and should not have to type
 * it again. Location is optional and opt-in: the browser only asks for GPS when
 * the person presses the button, never on page load.
 *
 * The form does not promise a repair. It says what CityFlow AI will actually do
 * with the report — merge it, weigh it, and pass it to the municipal team — and
 * it says who does the repairs. Promising more would be the easiest way to lose
 * a citizen's trust permanently.
 */

interface ReportFormProps {
  /** The person's home area, used as the default. */
  defaultArea: string;
  /** Their destination area, offered as a one-tap alternative. */
  destinationArea: string;
}

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

export function RoadReportForm({ defaultArea, destinationArea }: ReportFormProps) {
  const router = useRouter();

  const [areaLabel, setAreaLabel] = useState(defaultArea);
  const [issueType, setIssueType] = useState<RoadIssueType>("POTHOLE");
  const [severity, setSeverity] = useState<RoadIssueSeverity>("MEDIUM");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  function useMyLocation() {
    setLocationError(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("This browser cannot provide a location.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const { latitude, longitude } = position.coords;

        // A browser that fails to get a fix sometimes reports 0,0. Storing that
        // would put a permanent phantom road issue in the Atlantic.
        if (!isPlausibleCoordinate(latitude, longitude)) {
          setLocationError(
            "That location does not look right, so it has not been attached. Your report still works without it."
          );
          return;
        }

        setCoords({ lat: latitude, lng: longitude });
      },
      (error) => {
        setLocating(false);
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? "Location permission was refused. That is fine — the report will use the area name instead."
            : "Your location could not be found. The report will use the area name instead."
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setStatus({ kind: "saving" });

    try {
      const response = await fetch("/api/roads/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          areaLabel,
          issueType,
          severity,
          description,
          photo: photo ?? "",
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setFieldErrors(data.fieldErrors ?? {});
        setStatus({
          kind: "error",
          message: data.error ?? "That report could not be saved.",
        });
        return;
      }

      setStatus({ kind: "done", message: data.message });

      // Clear the parts that belong to this specific report; keep the area, as
      // somebody reporting one problem often reports another nearby.
      setDescription("");
      setPhoto(null);
      setCoords(null);

      // Re-renders the server component above, so the new issue appears in the
      // list without a manual refresh.
      router.refresh();
    } catch {
      setStatus({
        kind: "error",
        message: "We could not reach CityFlow AI. Please check your connection and try again.",
      });
    }
  }

  const saving = status.kind === "saving";

  return (
    <Card>
      <CardHeader
        title="Report a road issue"
        description="Tell us about a problem on a road you use. It takes about thirty seconds."
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <TextField
            label="Where is it?"
            value={areaLabel}
            onChange={(event) => setAreaLabel(event.target.value)}
            error={fieldErrors.areaLabel}
            required
            maxLength={80}
            hint="An area or landmark is enough — for example “Salt Lake Sector 5, near the metro station”."
          />

          {destinationArea && destinationArea !== areaLabel && (
            <button
              type="button"
              onClick={() => setAreaLabel(destinationArea)}
              className="mt-2 rounded-md px-2 py-1 text-xs font-medium text-primary underline-offset-2 hover:bg-primary-soft hover:underline"
            >
              Use {destinationArea} instead
            </button>
          )}
        </div>

        <ChoiceGroup
          legend="What is the problem?"
          choices={ROAD_ISSUE_TYPES.map((type) => ({
            value: type.code,
            label: type.label,
            hint: type.hint,
          }))}
          value={issueType}
          onChange={(value) => setIssueType(value as RoadIssueType)}
          columns={2}
          error={fieldErrors.issueType}
        />

        <ChoiceGroup
          legend="How bad is it?"
          description="Report what you actually saw. If reports disagree, CityFlow AI keeps the worst one — under-stating a hazard is the more dangerous mistake."
          choices={ROAD_ISSUE_SEVERITIES.map((level) => ({
            value: level.code,
            label: level.label,
            hint: level.hint,
          }))}
          value={severity}
          onChange={(value) => setSeverity(value as RoadIssueSeverity)}
          columns={3}
          error={fieldErrors.severity}
        />

        {/* --------------------------------------------------- description */}
        <div>
          <label
            htmlFor="road-description"
            className="mb-1.5 block text-sm font-medium text-fg"
          >
            Anything else? (optional)
          </label>
          <textarea
            id="road-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            maxLength={500}
            aria-describedby="road-description-hint"
            className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-fg placeholder:text-subtle"
            placeholder="For example: right lane, just after the flyover exit. Worse after rain."
          />
          <p id="road-description-hint" className="mt-1.5 text-xs text-subtle">
            {description.length}/500 characters. Please do not include anyone&apos;s personal
            details or vehicle numbers.
          </p>
        </div>

        {/* ------------------------------------------------------ location */}
        <div className="rounded-lg border border-border-base bg-surface-2 p-4">
          <p className="text-sm font-medium text-fg">Exact location (optional)</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Coordinates let CityFlow AI merge your report with other people&apos;s reports
            about the same spot, which is what turns a possible issue into a likely one.
            Without them the report is recorded against the area only.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={locating}
              onClick={useMyLocation}
              disabled={saving}
            >
              {coords ? "Update my location" : "Use my current location"}
            </Button>

            {coords && (
              <span className="text-xs text-muted">
                Attached:{" "}
                <span className="font-mono text-fg">
                  {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </span>
              </span>
            )}
          </div>

          {locationError && (
            <p role="status" className="mt-2 text-xs text-muted">
              {locationError}
            </p>
          )}
        </div>

        <PhotoInput value={photo} onChange={setPhoto} disabled={saving} />

        {status.kind === "error" && <Notice tone="error">{status.message}</Notice>}
        {status.kind === "done" && <Notice tone="success">{status.message}</Notice>}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="submit" loading={saving} fullWidth className="sm:w-auto">
            Send report
          </Button>
          <p className="text-xs leading-relaxed text-subtle">
            CityFlow AI passes reports to the municipal road-maintenance team and cannot
            carry out repairs itself.
          </p>
        </div>
      </form>
    </Card>
  );
}
