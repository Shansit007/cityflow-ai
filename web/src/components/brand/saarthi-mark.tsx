import { cn } from "@/lib/utils";

/**
 * Saarthi's mark.
 *
 * WHY NOT A SPEECH BUBBLE
 * A speech bubble says "there is a chatbot here", which is the least
 * interesting thing about this assistant and the thing people are most tired
 * of. "Saarthi" means charioteer — the one who handles the route so the
 * traveller can think about where they are going. So the mark is a compass
 * needle: a guide, pointing.
 *
 * It is drawn rather than imported as an image file so it inherits the current
 * text colour, stays sharp at any size, adds no network request, and works in
 * both themes without a second asset.
 */
export function SaarthiMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-5 w-5", className)}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* The dial. */}
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.6" />

      {/*
        The needle. Filled, so it stays legible when the whole mark is only
        16px across — a stroked needle at that size reads as a smudge.
      */}
      <path
        d="M15.6 8.4 10.9 10.9 8.4 15.6 13.1 13.1z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
