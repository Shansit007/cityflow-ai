"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThresholdControl } from "@/components/threshold-control";

const ROAD_ISSUES = [
  { href: "/", label: "Dashboard" },
  { href: "/reports", label: "Pothole Reports" },
  { href: "/priority", label: "Priority & Confirmed" },
  { href: "/assignments", label: "Work Assignments" },
];

const STAFF = [{ href: "/staff", label: "Employees & Teams" }];

export function Sidebar({
  threshold,
  canEditThreshold,
  cityName,
}: {
  threshold: number;
  canEditThreshold: boolean;
  cityName: string;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sections"
      className="flex w-full flex-col gap-1 bg-[var(--navy-dark)] px-4 py-5 text-white md:h-dvh md:w-64 md:shrink-0 md:overflow-y-auto"
    >
      <span className="text-xl font-bold tracking-tight">CityFlow AI</span>
      <span className="text-[10.5px] uppercase tracking-[0.09em] text-[#c9d8e5]">
        Municipal Road Maintenance
      </span>

      <Section title="Road Issues" />
      {ROAD_ISSUES.map((item) => (
        <NavLink key={item.href} {...item} pathname={pathname} />
      ))}

      <Section title="Municipal Staff" />
      {STAFF.map((item) => (
        <NavLink key={item.href} {...item} pathname={pathname} />
      ))}

      <Section title="Validation Rule" />
      <ThresholdControl threshold={threshold} editable={canEditThreshold} />

      <p className="mt-auto border-t border-white/15 pt-4 text-[11px] text-[#c9d8e5]">
        Prototype data &middot; {cityName} demonstration
      </p>
    </nav>
  );
}

function Section({ title }: { title: string }) {
  return (
    <h2 className="mt-6 mb-1 text-[10.5px] font-bold uppercase tracking-[0.13em] text-[#bfd0de]">
      {title}
    </h2>
  );
}

function NavLink({
  href,
  label,
  pathname,
}: {
  href: string;
  label: string;
  pathname: string;
}) {
  // Every section except the dashboard owns its subtree, so a report's detail page keeps
  // Pothole Reports lit rather than leaving the sidebar with nothing selected.
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-md px-3 py-2.5 text-sm font-semibold transition-colors ${
        active
          ? "bg-[#123f67] text-white ring-1 ring-[#4e86b4]"
          : "text-[#f7fafc] hover:bg-white/10"
      }`}
    >
      {label}
    </Link>
  );
}
