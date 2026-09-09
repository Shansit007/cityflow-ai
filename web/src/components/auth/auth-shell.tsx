"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { CityBackdrop } from "@/components/city/city-backdrop";
import { useCity } from "@/components/city/city-provider";
import { Container } from "@/components/ui/container";

/**
 * Shared frame for the sign-up and log-in pages.
 *
 * Left column: the form. Right column: a short reminder of what CityFlow AI does,
 * so the page still explains itself to someone who arrived from a shared link.
 */

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** Small line under the form, e.g. "Already have an account? Log in". */
  footer: ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  const { city } = useCity();

  return (
    <section className="relative overflow-hidden">
      <CityBackdrop height="md" />

      <Container width="wide" className="relative">
        <div className="grid items-start gap-12 py-14 sm:py-20 lg:grid-cols-[1fr_0.85fr]">
          {/* ------------------------------------------------------- form */}
          <div className="mx-auto w-full max-w-md lg:mx-0">
            <div className="rounded-card border border-border-base bg-surface p-6 shadow-raised sm:p-8">
              <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>

              <div className="mt-7">{children}</div>
            </div>

            <div className="mt-5 text-center text-sm text-muted lg:text-left">{footer}</div>
          </div>

          {/* ------------------------------------------------- reassurance */}
          <aside className="mx-auto w-full max-w-md lg:mx-0 lg:pt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
              You are joining for {city.name}
            </p>

            <h2 className="mt-3 text-xl font-semibold leading-snug text-fg">
              Smarter Departures, Smoother Journeys
            </h2>

            <ul className="mt-6 space-y-4">
              {[
                {
                  title: "You get an anonymous CityFlow ID",
                  body: "Your travel preferences are linked to an ID like CF-8X42K91, not to your name.",
                },
                {
                  title: "Your email is only for account access",
                  body: "Signing in, account recovery and important service messages. Nothing else.",
                },
                {
                  title: "Recommendations are suggestions",
                  body: "You always decide when to leave, and you can change your plan at any time.",
                },
              ].map((item) => (
                <li key={item.title} className="rounded-lg border border-border-base bg-surface p-4">
                  <p className="text-sm font-semibold text-fg">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{item.body}</p>
                </li>
              ))}
            </ul>

            <p className="mt-6 text-xs leading-relaxed text-subtle">
              Read more about{" "}
              <Link href="/how-it-works#privacy" className="font-medium text-primary underline">
                how CityFlow AI handles your data
              </Link>
              .
            </p>
          </aside>
        </div>
      </Container>
    </section>
  );
}
