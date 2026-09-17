import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  /** One sentence saying what this page is for. Omitted when the title says it. */
  description?: ReactNode;
  /** Primary action for the page, aligned right on wide screens. */
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-5">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-2 text-sm text-[var(--ink-muted)]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export interface SectionProps {
  title: string;
  /** Sits beside the heading: a count, a timestamp, a link to the whole list. */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Section({ title, aside, children, className }: SectionProps) {
  return (
    <section className={className}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {aside ? <div className="text-xs text-[var(--ink-muted)]">{aside}</div> : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export type StatTone = "neutral" | "accent" | "warn";

const TONES: Record<StatTone, string> = {
  neutral: "text-[var(--ink)]",
  accent: "text-[var(--accent)]",
  warn: "text-[var(--warn)]",
};

export interface StatProps {
  label: string;
  value: ReactNode;
  /** What the number means, when the label alone would leave it ambiguous. */
  hint?: ReactNode;
  tone?: StatTone;
}

/**
 * A single figure, large enough to read across a room.
 *
 * Tone is for the reading, not decoration: a count of roads over capacity is a warning
 * whatever page it appears on, and the same number reported as a saving is not.
 */
export function Stat({ label, value, hint, tone = "neutral" }: StatProps) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-raised)] p-4">
      <p className="text-xs font-medium text-[var(--ink-muted)]">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${TONES[tone]}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--ink-muted)]">{hint}</p> : null}
    </div>
  );
}

/** Even columns that collapse to one on a phone, which is where most travellers are. */
export function StatRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-[var(--line-strong)] p-8 text-center">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mx-auto mt-2 max-w-md text-sm text-[var(--ink-muted)]">
        {children}
      </div>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
