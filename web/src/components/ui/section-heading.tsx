import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * SectionHeading — the small caption + title + description block that opens
 * each section of the landing page. Keeps type hierarchy consistent everywhere.
 */

interface SectionHeadingProps {
  /** Small upper-case label above the title, e.g. "How it works". */
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  /** Centre the block. Used on full-width marketing sections. */
  align?: "left" | "center";
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "max-w-3xl",
        align === "center" && "mx-auto text-center",
        className
      )}
    >
      {eyebrow && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
          {eyebrow}
        </p>
      )}

      <h2 className="text-balance text-2xl font-semibold leading-tight text-fg sm:text-3xl">
        {title}
      </h2>

      {description && (
        <div className="mt-3 text-base leading-relaxed text-muted">{description}</div>
      )}
    </div>
  );
}
