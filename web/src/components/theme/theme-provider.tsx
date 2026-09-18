"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Light / dark theme.
 *
 * Three settings are supported:
 *   "light"  — always light
 *   "dark"   — always dark
 *   "system" — follow the operating system (the default for a new visitor)
 *
 * The chosen setting is remembered in localStorage under `cityflow-theme`.
 */

export type ThemeSetting = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "cityflow-theme";

interface ThemeContextValue {
  /** What the user picked. */
  theme: ThemeSetting;
  /** What is actually on screen right now (system resolved to light or dark). */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeSetting) => void;
  /** Convenience: light -> dark -> light. */
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Reads the current operating-system preference. */
function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Adds or removes the `dark` class that all our CSS variables key off. */
function applyThemeClass(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start with "system"; the effect below immediately corrects this from storage.
  const [theme, setThemeState] = useState<ThemeSetting>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  // --- 1. On first render, read the saved preference. --------------------
  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initial: ThemeSetting =
      stored === "light" || stored === "dark" || stored === "system" ? stored : "system";

    setThemeState(initial);

    const resolved = initial === "system" ? getSystemTheme() : initial;
    setResolvedTheme(resolved);
    applyThemeClass(resolved);
  }, []);

  // --- 2. Follow the OS while the setting is "system". -------------------
  useEffect(() => {
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      const resolved = getSystemTheme();
      setResolvedTheme(resolved);
      applyThemeClass(resolved);
    };

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [theme]);

  // --- 3. Changing the setting updates storage + the <html> class. --------
  const setTheme = useCallback((next: ThemeSetting) => {
    setThemeState(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);

    const resolved = next === "system" ? getSystemTheme() : next;
    setResolvedTheme(resolved);
    applyThemeClass(resolved);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Hook used by any component that needs to read or change the theme. */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme() must be used inside <ThemeProvider>.");
  }

  return context;
}

/**
 * A tiny script injected into <head> BEFORE the page paints.
 *
 * Without this, a user who prefers dark mode would see one white flash on every
 * page load, because React only runs after the HTML has already been drawn.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = stored === 'dark' || ((stored === 'system' || !stored) && prefersDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    }
  } catch (e) {
    /* If localStorage is blocked we simply stay on the light theme. */
  }
})();
`;
