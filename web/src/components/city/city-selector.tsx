"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { useCity } from "@/components/city/city-provider";
import { CITIES, searchCities, type City, type CityCode } from "@/lib/cities";
import { cn } from "@/lib/utils";

/**
 * City selector.
 *
 * Answers the first of the six questions the product must always make easy:
 * "Which city am I viewing?"
 *
 * Behaviour:
 *  - click (or press Enter/Space) on the trigger to open
 *  - type to search by city name, state or common alias ("bangalore", "blr")
 *  - Escape closes; clicking outside closes; focus returns to the trigger
 *  - arrow keys move through the results, Enter selects
 */

interface CitySelectorProps {
  /** "compact" is used inside the header, "full" on the landing hero. */
  variant?: "compact" | "full";
  className?: string;
}

export function CitySelector({ variant = "compact", className }: CitySelectorProps) {
  const { city, setCityCode } = useCity();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const listId = useId();

  const results = useMemo(() => searchCities(query), [query]);
  const popularCities = useMemo(() => CITIES.filter((c) => c.popular), []);

  // --- close on outside click ------------------------------------------------
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  // --- move focus into the search box when the panel opens -------------------
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // A short delay lets the panel mount before we focus it.
      const timer = window.setTimeout(() => searchRef.current?.focus(), 20);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  function choose(code: CityCode) {
    setCityCode(code);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      const selected = results[activeIndex];
      if (selected) {
        event.preventDefault();
        choose(selected.code);
      }
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)} onKeyDown={handleKeyDown}>
      {/* ---------------------------------------------------------- trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((isOpen) => !isOpen)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border border-border-base bg-surface text-fg transition-colors hover:bg-surface-2",
          variant === "compact" ? "h-10 px-3 text-sm" : "h-12 px-4 text-base"
        )}
      >
        <PinIcon />
        <span className="font-medium">{city.name}</span>
        <span className="sr-only-cf">— change city</span>
        <ChevronIcon open={open} />
      </button>

      {/* ------------------------------------------------------------ panel */}
      {open && (
        <div
          className={cn(
            "absolute right-0 z-50 mt-2 w-[19rem] rounded-card border border-border-base bg-surface p-3 shadow-float",
            "sm:w-[22rem]"
          )}
        >
          <label htmlFor={`${listId}-search`} className="sr-only-cf">
            Search for a city
          </label>
          <input
            ref={searchRef}
            id={`${listId}-search`}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            placeholder="Search city or state…"
            className="mb-3 h-10 w-full rounded-lg border border-border-strong bg-surface-2 px-3 text-sm text-fg placeholder:text-subtle"
          />

          {/* Quick picks, only while the user has not typed anything. */}
          {query.trim().length === 0 && (
            <div className="mb-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">
                Popular cities
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {popularCities.map((popularCity) => (
                  <button
                    key={popularCity.code}
                    type="button"
                    onClick={() => choose(popularCity.code)}
                    className={cn(
                      "rounded-lg border px-2.5 py-2 text-left text-sm transition-colors",
                      popularCity.code === city.code
                        ? "border-transparent bg-primary-soft font-medium text-primary"
                        : "border-border-base text-fg hover:bg-surface-2"
                    )}
                  >
                    {popularCity.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Full / filtered list. */}
          <ul
            id={listId}
            role="listbox"
            aria-label="Cities"
            className="max-h-64 overflow-y-auto"
          >
            {results.length === 0 && (
              <li className="px-2 py-6 text-center text-sm text-muted">
                No city matches “{query}”.
                <br />
                More cities are added as CityFlow AI expands.
              </li>
            )}

            {results.map((result, index) => (
              <CityOption
                key={result.code}
                city={result}
                selected={result.code === city.code}
                active={index === activeIndex}
                onSelect={() => choose(result.code)}
                onHover={() => setActiveIndex(index)}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function CityOption({
  city,
  selected,
  active,
  onSelect,
  onHover,
}: {
  city: City;
  selected: boolean;
  active: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  return (
    <li role="option" aria-selected={selected}>
      <button
        type="button"
        onClick={onSelect}
        onMouseEnter={onHover}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
          active && "bg-surface-2",
          selected && "bg-primary-soft"
        )}
      >
        <span className="min-w-0">
          <span
            className={cn(
              "block truncate text-sm",
              selected ? "font-semibold text-primary" : "text-fg"
            )}
          >
            {city.name}
          </span>
          <span className="block truncate text-xs text-subtle">{city.state}</span>
        </span>

        {selected && (
          <span className="shrink-0 text-xs font-medium text-primary">Selected</span>
        )}
      </button>
    </li>
  );
}

function PinIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-secondary"
    >
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("text-subtle transition-transform", open && "rotate-180")}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
