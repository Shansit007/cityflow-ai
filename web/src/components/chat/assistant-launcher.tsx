"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SaarthiMark } from "@/components/brand/saarthi-mark";
import { ASSISTANT_NAME, ASSISTANT_TAGLINE } from "@/lib/chat/branding";

/**
 * Saarthi, reachable from every page.
 *
 * WHY A SMALL CIRCLE RATHER THAN THE WIDE PILL IT USED TO BE
 * A button that is present on every screen has to earn very little space. The
 * previous version was a full "Ask Saarthi" pill, which was fine on a laptop
 * and sat on top of content on a phone — exactly where it is most likely to be
 * needed and least likely to be welcome covering something. So: a compact
 * circle, with the name appearing beside it only where there is room for it.
 *
 * It is a LINK to the assistant page, not a popup. The conversation has real
 * history and real decisions in it, so it gets a real page with its own URL
 * that can be bookmarked, shared and returned to.
 *
 * WHERE IT DOES NOT APPEAR
 *  - /assistant, because it would point at the page you are already reading
 *  - /admin, because the Admin Portal is a separate part of the product and
 *    must never carry commuter chrome
 *
 * It DOES appear during onboarding, deliberately: that is the moment somebody
 * is most likely to have a question about what any of this means.
 */

const HIDDEN_ON = ["/assistant", "/admin"];

export function AssistantLauncher() {
  const pathname = usePathname();

  if (HIDDEN_ON.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return null;
  }

  return (
    <Link
      href="/assistant"
      /*
        `group` drives the label reveal. `sm:` keeps the bare circle on phones,
        where horizontal space is scarcest and a growing pill would be most
        likely to cover something the person is trying to read.
      */
      className="group fixed bottom-4 right-4 z-40 inline-flex h-12 items-center gap-2.5 rounded-full bg-primary px-3.5 text-on-primary shadow-float transition-all hover:px-4 focus-visible:px-4 sm:bottom-5 sm:right-5"
      title={`Ask ${ASSISTANT_NAME} — ${ASSISTANT_TAGLINE}`}
    >
      <SaarthiMark className="h-5 w-5 shrink-0" />

      {/*
        The name is always in the accessible name of the link, so a screen
        reader announces "Ask Saarthi, your travel guide" whether or not the
        text is visible. Only its VISIBILITY is responsive.
      */}
      <span className="sr-only-cf">
        Ask {ASSISTANT_NAME}, {ASSISTANT_TAGLINE}
      </span>

      <span
        aria-hidden="true"
        className="hidden text-sm font-semibold sm:inline"
      >
        {ASSISTANT_NAME}
      </span>
    </Link>
  );
}
