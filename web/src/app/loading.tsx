import { Container } from "@/components/ui/container";

/**
 * Loading state shown while a page's server data is being prepared.
 *
 * Uses simple skeleton blocks rather than a spinner, so the layout does not jump
 * once the real content arrives.
 */
export default function Loading() {
  return (
    <section className="py-14" aria-busy="true" aria-live="polite">
      <Container width="wide">
        <span className="sr-only-cf">Loading…</span>

        <div className="h-8 w-64 animate-pulse rounded-lg bg-surface-2" />
        <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded-lg bg-surface-2" />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-card border border-border-base bg-surface-2"
            />
          ))}
        </div>
      </Container>
    </section>
  );
}
