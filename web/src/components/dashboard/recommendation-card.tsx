"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice, TextField } from "@/components/ui/input";
import type { DemandLevel } from "@/lib/demand/demand-model";
import { formatTime } from "@/lib/demand/time-slots";
import { demandBadgeTone, demandTextClass } from "@/lib/demand/ui";

/**
 * The single most important thing on the dashboard: "when should I leave?"
 *
 * Rules this component follows:
 *  - It states the recommendation, the usual time, and the reason — always all three.
 *  - It never claims a time saving. It reports predicted demand and an estimated
 *    arrival based on the journey time the user gave us.
 *  - "Why am I seeing this?" is one click away, and shows the actual numbers.
 *  - Nothing is recorded until the person presses a button.
 */

export type DecisionStatus = "PENDING" | "ACCEPTED" | "KEPT_USUAL" | "CUSTOM";

interface RecommendationCardProps {
  recommendedDeparture: string;
  usualDeparture: string;
  requiredArrival: string;
  estimatedArrival: string;
  estimatedJourneyMinutes: number;
  demandAtUsual: number;
  demandAtRecommended: number;
  levelAtUsual: DemandLevel;
  levelAtRecommended: DemandLevel;
  levelLabelAtUsual: string;
  levelLabelAtRecommended: string;
  suggestsChange: boolean;
  reason: string;
  benefit: string;
  warning: string | null;
  initialStatus: DecisionStatus;
  initialChosenDeparture: string | null;
}

export function RecommendationCard(props: RecommendationCardProps) {
  const router = useRouter();

  const [status, setStatus] = useState<DecisionStatus>(props.initialStatus);
  const [chosen, setChosen] = useState<string | null>(props.initialChosenDeparture);
  const [showWhy, setShowWhy] = useState(false);
  const [changing, setChanging] = useState(false);
  const [customTime, setCustomTime] = useState(props.usualDeparture);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function record(decision: DecisionStatus, chosenDeparture?: string) {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/recommendation/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, chosenDeparture }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "We could not save your choice. Please try again.");
        return;
      }

      setStatus(decision);
      setChosen(data.recommendation?.chosenDeparture ?? chosenDeparture ?? null);
      setChanging(false);
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-card border border-border-base bg-surface p-5 shadow-raised sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
            Today&apos;s travel recommendation
          </p>
          <h2 className="mt-2 text-sm text-muted">
            {props.suggestsChange
              ? "CityFlow AI suggests a small change today"
              : "Your usual time looks reasonable today"}
          </h2>
        </div>

        {status !== "PENDING" && (
          <Badge tone="primary">
            {status === "ACCEPTED"
              ? "Using recommended time"
              : status === "KEPT_USUAL"
                ? "Keeping usual time"
                : `Your plan: ${formatTime(chosen ?? props.usualDeparture)}`}
          </Badge>
        )}
      </div>

      {/* ---------------------------------------------------- the two times */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <TimeBlock
          caption="Recommended departure"
          time={props.recommendedDeparture}
          level={props.levelAtRecommended}
          levelLabel={props.levelLabelAtRecommended}
          emphasised
        />
        <TimeBlock
          caption="Your usual departure"
          time={props.usualDeparture}
          level={props.levelAtUsual}
          levelLabel={props.levelLabelAtUsual}
        />
      </div>

      {/* ------------------------------------------------------- the reason */}
      <div className="mt-5 space-y-3">
        <p className="rounded-lg bg-surface-2 p-4 text-sm leading-relaxed text-fg">
          {props.reason}
        </p>
        <p className="text-sm leading-relaxed text-muted">{props.benefit}</p>
      </div>

      {props.warning && (
        <div className="mt-4">
          <Notice tone="error">{props.warning}</Notice>
        </div>
      )}

      {error && (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      {/* ------------------------------------------------------ the actions */}
      {!changing ? (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            onClick={() => record(props.suggestsChange ? "ACCEPTED" : "KEPT_USUAL")}
            loading={saving}
            size="lg"
          >
            {props.suggestsChange
              ? `Use ${formatTime(props.recommendedDeparture)}`
              : `Keep ${formatTime(props.usualDeparture)}`}
          </Button>

          <Button variant="outline" size="lg" onClick={() => setChanging(true)}>
            Change my plan
          </Button>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-border-base bg-surface-2 p-4">
          <p className="text-sm font-medium text-fg">What time will you leave?</p>
          <p className="mt-1 text-xs text-muted">
            CityFlow AI records the time you actually choose, not the one it suggested.
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="sm:max-w-[12rem]">
              <TextField
                label="Your departure time"
                type="time"
                value={customTime}
                onChange={(event) => setCustomTime(event.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={() => record("CUSTOM", customTime)} loading={saving}>
                Save my plan
              </Button>
              <Button variant="ghost" onClick={() => setChanging(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------- explainability */}
      <div className="mt-6 border-t border-border-base pt-4">
        <button
          type="button"
          onClick={() => setShowWhy((open) => !open)}
          aria-expanded={showWhy}
          className="text-sm font-medium text-primary underline"
        >
          {showWhy ? "Hide the details" : "Why am I seeing this?"}
        </button>

        {showWhy && (
          <dl className="mt-4 space-y-2.5 text-sm">
            <WhyRow label="Your usual departure" value={formatTime(props.usualDeparture)} />
            <WhyRow
              label="Predicted demand then"
              value={`${props.levelLabelAtUsual} (${props.demandAtUsual}/100)`}
            />
            <WhyRow
              label="Recommended departure"
              value={formatTime(props.recommendedDeparture)}
            />
            <WhyRow
              label="Predicted demand then"
              value={`${props.levelLabelAtRecommended} (${props.demandAtRecommended}/100)`}
            />
            <WhyRow
              label="Estimated journey"
              value={`about ${props.estimatedJourneyMinutes} min at that demand level`}
            />
            <WhyRow
              label="Estimated arrival"
              value={formatTime(props.estimatedArrival)}
            />
            <WhyRow
              label="You need to arrive by"
              value={formatTime(props.requiredArrival)}
            />

            <p className="pt-2 text-xs leading-relaxed text-subtle">
              Demand is shown on a 0–100 index where higher means closer to, or beyond,
              comfortable road capacity. These figures are model predictions, not measured
              traffic counts, and the estimated journey time is based on the normal journey
              time you entered in your profile.
            </p>
          </dl>
        )}
      </div>
    </section>
  );
}

function TimeBlock({
  caption,
  time,
  level,
  levelLabel,
  emphasised = false,
}: {
  caption: string;
  time: string;
  level: DemandLevel;
  levelLabel: string;
  emphasised?: boolean;
}) {
  return (
    <div
      className={
        emphasised
          ? "rounded-lg border-2 border-primary bg-primary-soft p-4"
          : "rounded-lg border border-border-base bg-surface p-4"
      }
    >
      <p className="text-xs font-medium uppercase tracking-wider text-subtle">{caption}</p>

      <p
        className={
          emphasised
            ? "mt-1.5 text-3xl font-semibold tracking-tight text-primary"
            : "mt-1.5 text-3xl font-semibold tracking-tight text-fg"
        }
      >
        {formatTime(time)}
      </p>

      <p className={`mt-2 text-xs font-medium ${demandTextClass(level)}`}>
        Predicted demand: {levelLabel}
      </p>

      <div className="mt-1">
        <Badge tone={demandBadgeTone(level)}>{levelLabel}</Badge>
      </div>
    </div>
  );
}

function WhyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border-base pb-2 last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-fg">{value}</dd>
    </div>
  );
}
