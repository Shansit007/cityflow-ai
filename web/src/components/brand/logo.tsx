import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * CityFlow AI wordmark.
 *
 * The mark is three staggered lanes inside a rounded square — a small picture of
 * the core idea: the same trips, spread across time instead of stacked on top of
 * each other.
 */

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn("h-9 w-9", className)}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="0" y="0" width="40" height="40" rx="10" fill="var(--cf-primary)" />

      {/* Three lanes of traffic, staggered — the "smoothing" idea. */}
      <g
        stroke="var(--cf-fg-inverse)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.95"
      >
        <path d="M9 13h13" />
        <path d="M9 20h22" />
        <path d="M9 27h17" />
      </g>

      {/* A single moving dot: the commuter who left at a better time. */}
      <circle cx="31" cy="13" r="3" fill="var(--cf-secondary)" />
    </svg>
  );
}

interface LogoProps {
  /** Renders without the text, for tight spaces. */
  markOnly?: boolean;
  /** Wraps the logo in a link to the home page. */
  href?: string;
  className?: string;
}

export function Logo({ markOnly = false, href = "/", className }: LogoProps) {
  const content = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />

      {!markOnly && (
        <span className="flex flex-col leading-none">
          <span className="text-[1.05rem] font-semibold tracking-tight text-fg">
            CityFlow <span className="text-secondary">AI</span>
          </span>
          <span className="mt-1 hidden text-[0.66rem] font-medium uppercase tracking-[0.12em] text-subtle sm:block">
            Public mobility intelligence
          </span>
        </span>
      )}
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} className="rounded-lg" aria-label="CityFlow AI — home">
      {content}
    </Link>
  );
}
