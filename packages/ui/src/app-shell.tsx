import type { ReactNode } from "react";

export interface AppShellProps {
  productName: string;
  /** Sits behind everything, full bleed and fixed while the page scrolls over it. */
  backdrop?: ReactNode;
  /** Distinguishes the two deployed surfaces in the header, e.g. "Municipal". */
  surface?: string;
  nav?: ReactNode;
  /** The two deployed surfaces make different promises, so they say different things. */
  footnote?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  productName,
  surface,
  nav,
  footnote,
  backdrop,
  children,
}: AppShellProps) {
  return (
    <div className="relative flex min-h-dvh flex-col text-[var(--ink)]">
      {backdrop}
      <header className="border-b border-[var(--line)]">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-4 sm:px-6">
          <span className="font-semibold tracking-tight">{productName}</span>
          {surface ? (
            <span className="rounded border border-[var(--line)] px-2 py-0.5 text-xs text-[var(--ink-muted)]">
              {surface}
            </span>
          ) : null}
          {nav ? <nav className="ml-auto text-sm">{nav}</nav> : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>

      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 text-xs text-[var(--ink-muted)] sm:px-6">
          {footnote ?? "Open source. Departure times are advisory and never mandatory."}
        </div>
      </footer>
    </div>
  );
}
