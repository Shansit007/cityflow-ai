"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/ui/container";

/**
 * Site footer.
 *
 * Also carries the honesty notice: CityFlow AI is a capstone research project,
 * not an official government service. Saying so plainly is part of the product's
 * credibility, not a disclaimer bolted on at the end.
 */

const FOOTER_SECTIONS = [
  {
    title: "Product",
    links: [
      { href: "/how-it-works", label: "How CityFlow AI works" },
      { href: "/signup", label: "Create an account" },
      { href: "/login", label: "Log in" },
    ],
  },
  {
    title: "Understanding",
    links: [
      { href: "/how-it-works#demand-smoothing", label: "What is demand smoothing" },
      { href: "/how-it-works#explainability", label: "Why you see a recommendation" },
      { href: "/how-it-works#privacy", label: "Privacy and your CityFlow ID" },
    ],
  },
];

export function SiteFooter() {
  const pathname = usePathname();

  // The Admin Portal is a working tool, not a public page: it does not need
  // the marketing link columns. It keeps the honesty notice, which applies
  // everywhere.
  if (pathname.startsWith("/admin")) {
    return (
      <footer className="mt-16 border-t border-border-base bg-surface">
        <Container width="wide">
          <p className="py-6 text-xs leading-relaxed text-subtle">
            CityFlow AI Admin Portal · figures on these pages are aggregated counts and model
            predictions, not measured traffic. An academic capstone project; not an official
            government service.
          </p>
        </Container>
      </footer>
    );
  }

  return (
    <footer className="mt-24 border-t border-border-base bg-surface">
      <Container width="wide">
        <div className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand + one-line summary */}
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
              CityFlow AI helps reduce peak traffic by recommending when to travel, before
              congestion builds up. Recommendations are suggestions — you always decide when
              you leave.
            </p>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h2 className="text-sm font-semibold text-fg">{section.title}</h2>
              <ul className="mt-3 space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted transition-colors hover:text-fg"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t border-border-base py-6 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} CityFlow AI · Smarter Departures, Smoother Journeys
          </p>
          <p className="max-w-xl sm:text-right">
            An academic capstone project. CityFlow AI is not an official government service,
            and its predictions are estimates, not guarantees.
          </p>
        </div>
      </Container>
    </footer>
  );
}
