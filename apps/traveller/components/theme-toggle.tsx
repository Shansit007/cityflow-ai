"use client";

import { useEffect, useState } from "react";

type Choice = "system" | "light" | "dark";

const STORAGE_KEY = "cityflow-theme";

const NEXT: Record<Choice, Choice> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const LABEL: Record<Choice, string> = {
  system: "Match device",
  light: "Light",
  dark: "Dark",
};

function apply(choice: Choice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

export function ThemeToggle() {
  const [choice, setChoice] = useState<Choice>("system");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark") {
        setChoice(stored);
        apply(stored);
      }
    } catch {
      // Private windows and blocked site data both throw here. The device preference
      // still applies, so there is nothing to recover from.
    }
  }, []);

  function cycle() {
    const next = NEXT[choice];
    setChoice(next);
    apply(next);
    try {
      if (next === "system") window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice still holds for this page; it just will not survive a reload.
    }
  }

  return (
    <button
      type="button"
      onClick={cycle}
      className="rounded px-2 py-1 text-[var(--ink-muted)] hover:text-[var(--ink)]"
      title="Switch between light, dark and your device setting"
    >
      <span className="sr-only">Theme: </span>
      {LABEL[choice]}
    </button>
  );
}
