"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ASSISTANT_NAME } from "@/lib/chat/branding";

/**
 * A quick way into the assistant from anywhere in the commuter portal.
 *
 * It is a LINK to the assistant page, not a popup. The conversation is a real
 * part of the product with its own history, so it gets a real page — this is
 * just the shortcut to it.
 *
 * It hides itself on the assistant page (where it would be pointing at the page
 * you are already on) and on the onboarding flow (where a floating button would
 * sit on top of the form).
 */

const HIDDEN_ON = ["/assistant", "/onboarding"];

export function AssistantLauncher() {
  const pathname = usePathname();

  if (HIDDEN_ON.some((path) => pathname.startsWith(path))) return null;

  return (
    <Link
      href="/assistant"
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2.5 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-on-primary shadow-float transition-transform hover:scale-[1.03]"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 21l1.9-5A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />
      </svg>
      Ask {ASSISTANT_NAME}
    </Link>
  );
}
