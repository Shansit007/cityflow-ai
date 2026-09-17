import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";

export type Section = "today" | "routines" | "rewards" | "account";

const SECTIONS: { key: Section; href: string; label: string }[] = [
  { key: "today", href: "/today", label: "Today" },
  { key: "routines", href: "/routines", label: "Routines" },
  { key: "rewards", href: "/rewards", label: "Rewards" },
  { key: "account", href: "/account", label: "Account" },
];

/**
 * The signed-in navigation, with the section you are on marked.
 *
 * Every page used to carry one hand-written link to whichever other page seemed most
 * useful from it, so there was no way to reach Routines from Report, and nothing ever
 * told you where you were.
 */
export function TravellerNav({ current }: { current?: Section }) {
  return (
    <ul className="flex items-center gap-1">
      {SECTIONS.map((section) => {
        const here = section.key === current;
        return (
          <li key={section.key}>
            <Link
              href={section.href}
              aria-current={here ? "page" : undefined}
              className={
                here
                  ? "rounded px-2 py-1 font-medium text-[var(--ink)]"
                  : "rounded px-2 py-1 text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }
            >
              {section.label}
            </Link>
          </li>
        );
      })}
      <li className="ml-2 border-l border-[var(--line)] pl-2">
        <ThemeToggle />
      </li>
    </ul>
  );
}

export function SignedOutNav() {
  return (
    <div className="flex items-center gap-2">
      <Link href="/signin" className="text-[var(--ink-muted)] hover:text-[var(--ink)]">
        I have a City ID
      </Link>
      <span className="text-[var(--line)]">|</span>
      <ThemeToggle />
    </div>
  );
}
