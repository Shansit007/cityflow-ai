import type { ReactNode } from "react";

export interface AppShellProps {
  productName: string;
  /** Distinguishes the two deployed surfaces in the header, e.g. "Municipal". */
  surface?: string;
  nav?: ReactNode;
  children: ReactNode;
}

export function AppShell({ productName, surface, nav, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-[var(--surface)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)]">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 py-4">
          <span className="font-semibold tracking-tight">{productName}</span>
          {surface ? (
            <span className="rounded border border-[var(--line)] px-2 py-0.5 text-xs text-[var(--ink-muted)]">
              {surface}
            </span>
          ) : null}
          {nav ? <nav className="ml-auto text-sm">{nav}</nav> : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">{children}</main>

      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 text-xs text-[var(--ink-muted)]">
          Open source. Departure times are advisory and never mandatory.
        </div>
      </footer>
    </div>
  );
}
