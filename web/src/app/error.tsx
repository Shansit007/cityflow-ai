"use client";

import { useEffect } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

/**
 * Global error screen.
 *
 * Next.js renders this whenever a page throws. It shows a calm, useful message
 * instead of a stack trace, and offers a way to recover.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The full error goes to the server log, never to the visitor's screen.
    console.error("[page error]", error);
  }, [error]);

  return (
    <section className="py-24">
      <Container width="narrow" className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-danger">
          Something went wrong
        </p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg">
          This page could not be loaded
        </h1>

        <p className="mt-4 text-base leading-relaxed text-muted">
          The problem has been logged. You can try again, or go back to the home page.
        </p>

        {/* During development the message is genuinely useful, so show it. */}
        {process.env.NODE_ENV === "development" && (
          <pre className="mt-6 overflow-x-auto rounded-lg bg-surface-2 p-4 text-left text-xs text-muted">
            {error.message}
          </pre>
        )}

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={reset}>Try again</Button>
          <ButtonLink href="/" variant="outline">
            Back to home
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
