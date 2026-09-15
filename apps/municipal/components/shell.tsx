import type { ReactNode } from "react";

import { Sidebar } from "@/components/sidebar";
import { SignOut } from "@/components/sign-out";
import type { StaffSession } from "@/lib/session";

export function Shell({
  session,
  threshold,
  cityName,
  title,
  subtitle,
  children,
}: {
  session: StaffSession;
  threshold: number;
  cityName: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar
        threshold={threshold}
        canEditThreshold={session.role === "head"}
        cityName={cityName}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-end gap-4 border-b border-[var(--line)] bg-[var(--surface-raised)] px-5 py-3 text-sm">
          <span className="text-[var(--ink-muted)]">
            {session.displayName} &middot; {session.city} &middot;{" "}
            {session.role === "head" ? "Head of Road Maintenance" : "Field staff"}
          </span>
          <SignOut />
        </header>

        <main className="min-w-0 flex-1 px-5 py-6">
          <h1 className="text-[31px] font-bold leading-tight tracking-tight text-[var(--navy-dark)] dark:text-[var(--ink)]">
            {title}
          </h1>
          <p className="mt-2 mb-5 max-w-3xl text-sm text-[var(--ink-muted)]">
            {subtitle}
          </p>
          {children}
        </main>

        <Disclaimer />
      </div>
    </div>
  );
}

/**
 * Says what this is, on every page.
 *
 * The dashboard borrows the visual language of a government system, which is the right
 * choice for the people who would use it and exactly the reason it has to say plainly
 * that it is not one. Nothing here is endorsed by any municipal body and every record
 * on screen came out of infra/seed_demo.py.
 */
function Disclaimer() {
  return (
    <footer className="mt-6 bg-[var(--navy-dark)] px-5 py-4 text-white">
      <div className="flex flex-wrap justify-between gap-4 text-xs">
        <span>
          <strong>CityFlow AI &mdash; Municipal Road Maintenance</strong>
          <br />
          Open-source prototype
        </span>
        <span>
          Road issue monitoring &middot; Field assignment
          <br />
          Reports aggregated from independent travellers
        </span>
      </div>
      <p className="mt-3 border-t border-white/20 pt-2.5 text-[10.5px] leading-relaxed text-[#c8d4de]">
        This is a prototype. It is not an official system of any municipal corporation, is
        not connected to any live municipal database, and the records shown are generated
        by a seed script. The interface exists to demonstrate how automatically detected
        road defects could be received, validated and assigned by a road-maintenance
        department.
      </p>
    </footer>
  );
}
