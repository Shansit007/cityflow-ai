import { cn } from "@/lib/utils";

/**
 * The four-step progress indicator.
 *
 * Shows names on wide screens and a compact "Step 2 of 4" line on phones,
 * because four full labels do not fit on a small display without wrapping into
 * something unreadable.
 */

export const ONBOARDING_STEPS = [
  { title: "Your journey", subtitle: "Where you travel" },
  { title: "Your schedule", subtitle: "When you travel" },
  { title: "Preferences", subtitle: "What you are open to" },
  { title: "Privacy", subtitle: "What we store" },
] as const;

export function Stepper({ current }: { current: number }) {
  const step = ONBOARDING_STEPS[current];

  return (
    <div>
      {/* Mobile: one clear line. */}
      <p className="text-sm font-medium text-muted sm:hidden">
        Step {current + 1} of {ONBOARDING_STEPS.length} · {step.title}
      </p>

      {/* Desktop: the full path, so the person can see how much is left. */}
      <ol className="hidden items-center gap-2 sm:flex" aria-label="Onboarding progress">
        {ONBOARDING_STEPS.map((item, index) => {
          const isDone = index < current;
          const isCurrent = index === current;

          return (
            <li key={item.title} className="flex flex-1 items-center gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                    isCurrent && "bg-primary text-on-primary",
                    isDone && "bg-primary-soft text-primary",
                    !isCurrent && !isDone && "bg-surface-2 text-subtle"
                  )}
                >
                  {isDone ? "✓" : index + 1}
                </span>

                <span className="min-w-0">
                  <span
                    className={cn(
                      "block truncate text-xs font-medium",
                      isCurrent ? "text-fg" : "text-muted"
                    )}
                  >
                    {item.title}
                  </span>
                </span>
              </div>

              {index < ONBOARDING_STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-px flex-1",
                    index < current ? "bg-primary" : "bg-border-base"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Announced to screen readers on every step change. */}
      <p className="sr-only-cf" aria-live="polite">
        Step {current + 1} of {ONBOARDING_STEPS.length}: {step.title}
      </p>
    </div>
  );
}
