import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Card — the standard surface used for grouping related content.
 *
 * Kept visually quiet on purpose: a hairline border and a very soft shadow.
 * Emphasis should come from typography and semantic colour, not from heavy
 * boxes stacked on top of each other.
 */

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Slightly stronger elevation, for the single most important card on a page. */
  raised?: boolean;
  /** Removes the default padding when the card holds a map or a full-bleed chart. */
  flush?: boolean;
}

export function Card({ children, className, raised = false, flush = false }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-border-base bg-surface",
        raised ? "shadow-raised" : "shadow-card",
        !flush && "p-5 sm:p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  /** Optional supporting line under the title. */
  description?: string;
  /** Optional element on the right, e.g. a status badge or a small action. */
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, description, action, className }: CardHeaderProps) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-fg">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
