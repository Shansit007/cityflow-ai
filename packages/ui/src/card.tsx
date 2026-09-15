import type { ReactNode } from "react";

export interface CardProps {
  children: ReactNode;
  className?: string;
}

/** A single hairline and a raised surface. No shadow: everything here sits flat. */
export function Card({ children, className }: CardProps) {
  return (
    <div
      className={`rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-raised)] p-5 ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
