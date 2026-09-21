"use client";

import { useId } from "react";
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * Text input with a proper label, help text and error message.
 *
 * ACCESSIBILITY
 *  - every input gets a real <label> tied to it by id (not just a placeholder)
 *  - errors are announced to screen readers via aria-describedby + role="alert"
 *  - aria-invalid marks the field as wrong, independently of its red colour
 */

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  /** Small grey line under the field explaining what to enter. */
  hint?: ReactNode;
  /** Validation message. When present the field is styled and marked as invalid. */
  error?: string;
  /** Optional element shown on the right inside the field (e.g. show/hide password). */
  trailing?: ReactNode;
}

export function TextField({
  label,
  hint,
  error,
  trailing,
  className,
  required,
  ...rest
}: TextFieldProps) {
  // useId gives a stable unique id that also works with server rendering.
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="w-full">
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-fg">
        {label}
        {required && (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>

      <div className="relative">
        <input
          {...rest}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy.length > 0 ? describedBy : undefined}
          className={cn(
            "h-11 w-full rounded-lg border bg-surface px-3.5 text-sm text-fg",
            "placeholder:text-subtle",
            "transition-colors duration-150",
            error ? "border-danger" : "border-border-strong hover:border-primary",
            // `trailing` is a ReactNode, so `trailing && "pr-11"` could evaluate to
            // 0 or "" rather than a class name. A ternary keeps the type honest.
            trailing ? "pr-11" : null,
            className
          )}
        />

        {trailing && (
          <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>
        )}
      </div>

      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-subtle">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Multi-line text input, styled to match `TextField` and carrying the same
 * accessibility contract: a real label, error announced via aria-describedby
 * and role="alert", aria-invalid independent of colour.
 */
interface TextareaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label: string;
  hint?: ReactNode;
  error?: string;
}

export function TextareaField({
  label,
  hint,
  error,
  className,
  required,
  rows = 4,
  ...rest
}: TextareaFieldProps) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="w-full">
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-fg">
        {label}
        {required && (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>

      <textarea
        {...rest}
        id={inputId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy.length > 0 ? describedBy : undefined}
        className={cn(
          "w-full resize-y rounded-lg border bg-surface px-3.5 py-2.5 text-sm text-fg",
          "placeholder:text-subtle",
          "transition-colors duration-150",
          error ? "border-danger" : "border-border-strong hover:border-primary",
          className
        )}
      />

      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-subtle">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * A page-level message box (success / error / information).
 * Uses an icon-free, text-first design so the meaning never depends on colour.
 */
export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "error";
  children: ReactNode;
}) {
  const toneClasses = {
    info: "border-border-base bg-surface-2 text-fg",
    success: "border-transparent bg-traffic-low-soft text-traffic-low",
    error: "border-transparent bg-traffic-high-soft text-traffic-high",
  } as const;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-lg border px-4 py-3 text-sm", toneClasses[tone])}
    >
      {children}
    </div>
  );
}
