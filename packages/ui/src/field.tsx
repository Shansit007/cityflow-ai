import type { ReactNode } from "react";

export interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, hint, error, children }: FieldProps) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={describedBy} className="text-xs text-[var(--ink-muted)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={describedBy} role="alert" className="text-xs text-[var(--warn)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const inputStyle =
  "w-full rounded-[var(--radius)] border border-[var(--line-strong)]" +
  " bg-[var(--surface-raised)] px-3 py-2.5 text-sm text-[var(--ink)]" +
  " placeholder:text-[var(--ink-faint)]";
