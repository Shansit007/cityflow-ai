"use client";

import { useId } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Card-style pickers used throughout onboarding and the profile editor.
 *
 * ACCESSIBILITY
 * These look like cards but behave like real radio buttons and checkboxes: a
 * hidden native input does the work, so keyboard navigation, screen readers and
 * form semantics all behave exactly as a user expects. The card is only paint.
 */

export interface Choice<T extends string> {
  value: T;
  label: string;
  /** Optional second line. */
  hint?: string;
}

interface ChoiceGroupProps<T extends string> {
  legend: string;
  /** Optional explanation shown under the legend. */
  description?: ReactNode;
  choices: Array<Choice<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Columns at the small breakpoint and up. */
  columns?: 1 | 2 | 3;
  error?: string;
}

/** Single-choice card group (behaves as radio buttons). */
export function ChoiceGroup<T extends string>({
  legend,
  description,
  choices,
  value,
  onChange,
  columns = 2,
  error,
}: ChoiceGroupProps<T>) {
  const groupName = useId();

  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-fg">{legend}</legend>
      {description && <p className="mb-3 text-xs leading-relaxed text-subtle">{description}</p>}

      <div
        className={cn(
          "grid gap-2",
          columns === 1 && "grid-cols-1",
          columns === 2 && "sm:grid-cols-2",
          columns === 3 && "sm:grid-cols-3"
        )}
      >
        {choices.map((choice) => {
          const selected = choice.value === value;

          return (
            <label
              key={choice.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                selected
                  ? "border-primary bg-primary-soft"
                  : "border-border-base bg-surface hover:bg-surface-2"
              )}
            >
              <input
                type="radio"
                name={groupName}
                value={choice.value}
                checked={selected}
                onChange={() => onChange(choice.value)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--cf-primary)]"
              />
              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-sm",
                    selected ? "font-semibold text-primary" : "font-medium text-fg"
                  )}
                >
                  {choice.label}
                </span>
                {choice.hint && (
                  <span className="mt-0.5 block text-xs text-muted">{choice.hint}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

interface MultiChoiceGroupProps<T extends string> {
  legend: string;
  description?: ReactNode;
  choices: Array<Choice<T>>;
  values: T[];
  onChange: (values: T[]) => void;
  columns?: 1 | 2 | 3;
  error?: string;
}

/**
 * Multi-choice card group (behaves as checkboxes).
 *
 * `values` defends against `undefined` even though callers are typed to
 * always pass an array: a form whose initial values came from a database
 * row (an existing journey's `travelDays`, for instance) can still hand this
 * component `undefined` at runtime if that row's data is incomplete, and
 * that used to crash the whole form instead of just showing nothing picked.
 */
export function MultiChoiceGroup<T extends string>({
  legend,
  description,
  choices,
  values,
  onChange,
  columns = 2,
  error,
}: MultiChoiceGroupProps<T>) {
  const selected = values ?? [];

  function toggle(value: T) {
    onChange(
      selected.includes(value)
        ? selected.filter((existing) => existing !== value)
        : [...selected, value]
    );
  }

  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-fg">{legend}</legend>
      {description && <p className="mb-3 text-xs leading-relaxed text-subtle">{description}</p>}

      <div
        className={cn(
          "grid gap-2",
          columns === 1 && "grid-cols-1",
          columns === 2 && "sm:grid-cols-2",
          columns === 3 && "sm:grid-cols-3"
        )}
      >
        {choices.map((choice) => {
          const isSelected = selected.includes(choice.value);

          return (
            <label
              key={choice.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                isSelected
                  ? "border-secondary bg-secondary-soft"
                  : "border-border-base bg-surface hover:bg-surface-2"
              )}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(choice.value)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--cf-secondary)]"
              />
              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-sm",
                    isSelected ? "font-semibold text-secondary" : "font-medium text-fg"
                  )}
                >
                  {choice.label}
                </span>
                {choice.hint && (
                  <span className="mt-0.5 block text-xs text-muted">{choice.hint}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/**
 * A yes/no switch with a label and an explanation.
 * Uses a real checkbox underneath, styled as a track and knob.
 */
export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-border-base bg-surface p-4 transition-colors hover:bg-surface-2">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-fg">{label}</span>
        {description && (
          <span className="mt-1 block text-xs leading-relaxed text-muted">{description}</span>
        )}
      </span>

      <span className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only-cf"
        />
        <span
          aria-hidden="true"
          className={cn(
            "block h-6 w-11 rounded-full transition-colors",
            checked ? "bg-primary" : "bg-surface-3"
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            "absolute left-0.5 top-0.5 block h-5 w-5 rounded-full bg-surface shadow-card transition-transform",
            checked && "translate-x-5"
          )}
        />
      </span>
    </label>
  );
}
