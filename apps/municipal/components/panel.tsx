import type { ReactNode } from "react";

export function Panel({
  title,
  subtitle,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-raised)] p-4 ${className ?? ""}`}
    >
      {title ? (
        <h2 className="text-lg font-bold text-[var(--navy-dark)] dark:text-[var(--ink)]">
          {title}
        </h2>
      ) : null}
      {subtitle ? (
        <p className="mt-0.5 mb-3 text-xs text-[var(--ink-muted)]">{subtitle}</p>
      ) : null}
      {children}
    </section>
  );
}

export function Kpi({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-raised)] p-4">
      <dt className="text-xs font-semibold text-[var(--ink-muted)]">{label}</dt>
      <dd className="mt-1 text-[29px] font-bold leading-none tabular-nums text-[var(--navy-dark)] dark:text-[var(--ink)]">
        {value}
      </dd>
      <p className="mt-1 text-[11px] text-[var(--ink-faint)]">{note}</p>
    </div>
  );
}
