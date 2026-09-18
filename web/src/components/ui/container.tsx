import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Container — the shared horizontal rhythm of every page.
 *
 * One place controls the maximum content width and the side padding, so pages
 * line up perfectly with the header and with each other.
 */

interface ContainerProps {
  children: ReactNode;
  className?: string;
  /** "wide" is for dashboards and maps, "default" for reading-heavy pages. */
  width?: "default" | "wide" | "narrow";
}

const WIDTH_CLASSES = {
  narrow: "max-w-2xl",
  default: "max-w-6xl",
  wide: "max-w-7xl",
} as const;

export function Container({ children, className, width = "default" }: ContainerProps) {
  return (
    <div className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", WIDTH_CLASSES[width], className)}>
      {children}
    </div>
  );
}
