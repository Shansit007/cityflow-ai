import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Badge — a small status chip.
 *
 * ACCESSIBILITY RULE FOLLOWED HERE
 * Status is never communicated by colour alone. Every badge shows a text label,
 * and traffic/road badges additionally show a small shape marker, so the meaning
 * survives for colour-blind users and in black-and-white printouts.
 */

export type BadgeTone =
  | "neutral"
  | "primary"
  | "secondary"
  | "low"
  | "moderate"
  | "high"
  | "severe";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-muted border-border-base",
  primary: "bg-primary-soft text-primary border-transparent",
  secondary: "bg-secondary-soft text-secondary border-transparent",
  low: "bg-traffic-low-soft text-traffic-low border-transparent",
  moderate: "bg-traffic-moderate-soft text-traffic-moderate border-transparent",
  high: "bg-traffic-high-soft text-traffic-high border-transparent",
  severe: "bg-traffic-severe-soft text-traffic-severe border-transparent",
};

/** Shape markers so the status is readable without relying on colour. */
const TONE_MARKER: Record<BadgeTone, string | null> = {
  neutral: null,
  primary: null,
  secondary: null,
  low: "●",
  moderate: "▲",
  high: "◆",
  severe: "■",
};

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  const marker = TONE_MARKER[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        TONE_CLASSES[tone],
        className
      )}
    >
      {marker && (
        <span aria-hidden="true" className="text-[0.6rem] leading-none">
          {marker}
        </span>
      )}
      {children}
    </span>
  );
}
