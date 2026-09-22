"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { DEFAULT_CITY_CODE, getCity, nearestCity, type City, type CityCode } from "@/lib/cities";

/**
 * Selected city.
 *
 * The chosen city drives:
 *   - the wording in the header and hero
 *   - the illustrated backdrop
 *   - the map centre and the traffic/demand data that is loaded
 *   - which city Saarthi and the trip planner read from the database
 *
 * It is stored in three places, each for a different reason:
 *   - localStorage  so the browser remembers it instantly on the next visit
 *   - a cookie      so the SERVER can also read it when rendering a page
 *   - `User.cityCode` in the database, so anything that reads the signed-in
 *     user's row (Saarthi, the trip planner, admin analytics) agrees with
 *     what the person sees on screen. Signed-out visitors only get the first
 *     two — there is no account row to update — and that persist call is
 *     fire-and-forget: it never blocks the UI and a failure is silent, since
 *     the cookie is already the source of truth for the current tab.
 *
 * PRIORITY — how the active city is decided, in order:
 *   1. Location ON (permission already granted, or just granted by the
 *      person): the device's coordinates are resolved to the nearest
 *      supported city and that city becomes active, overriding whatever was
 *      stored before.
 *   2. Location OFF or unavailable: the city last chosen manually — through
 *      the travel-plan form, the only place a person can pick a city by hand
 *      — stays active. The app works fully either way; location is never
 *      forced on anyone.
 */

const CITY_STORAGE_KEY = "cityflow-city";
const CITY_COOKIE_NAME = "cityflow_city";
const CITY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // one year

/** Where the browser currently stands on sharing device location. */
export type LocationStatus =
  | "idle"
  | "detecting"
  | "granted"
  | "denied"
  | "unsupported"
  | "unresolved";

interface CityContextValue {
  city: City;
  cityCode: CityCode;
  /** Manual selection — the travel-plan form is the only caller of this. */
  setCityCode: (code: CityCode) => void;
  /** False until the saved city has been read from the browser. */
  ready: boolean;
  /** Current state of device-location detection. */
  locationStatus: LocationStatus;
  /**
   * Ask the browser for the device's position and, if it resolves to a
   * supported city, make that city active. Safe to call even when location
   * is unsupported or the person declines — it just updates locationStatus.
   */
  requestLocation: () => void;
}

const CityContext = createContext<CityContextValue | null>(null);

/** Writes the city cookie so server components can read the same value. */
function writeCityCookie(code: CityCode) {
  document.cookie = `${CITY_COOKIE_NAME}=${code}; path=/; max-age=${CITY_COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * Best-effort sync to the signed-in user's account. Fire-and-forget on
 * purpose — a signed-out visitor gets a harmless 401, and a network hiccup
 * here should never block the city from changing in this tab.
 */
function persistCityCode(code: CityCode) {
  fetch("/api/profile/city", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cityCode: code }),
  }).catch(() => {
    // Signed out, offline, or the request otherwise failed — the cookie
    // still carries the choice for this tab, so there is nothing to recover.
  });
}

interface CityProviderProps {
  children: ReactNode;
  /**
   * City known on the server (from the cookie or the signed-in user's profile).
   * Passing it avoids a visible "flash" of the default city on first paint.
   */
  initialCityCode?: CityCode;
}

export function CityProvider({ children, initialCityCode }: CityProviderProps) {
  const [cityCode, setCityCodeState] = useState<CityCode>(
    initialCityCode ?? DEFAULT_CITY_CODE
  );
  const [ready, setReady] = useState(false);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");

  // Guards against setting state after the component has unmounted, and
  // against a stray auto-detect firing twice in React's Strict Mode.
  const detectStartedRef = useRef(false);

  // Read the saved preference once, on the client.
  useEffect(() => {
    const stored = window.localStorage.getItem(CITY_STORAGE_KEY);
    const resolved = getCity(stored ?? initialCityCode).code;

    setCityCodeState(resolved);
    writeCityCookie(resolved);
    setReady(true);
  }, [initialCityCode]);

  /** Applies a newly detected or chosen city everywhere it needs to live. */
  const applyCityCode = useCallback((code: CityCode, { persist }: { persist: boolean }) => {
    setCityCodeState(code);
    window.localStorage.setItem(CITY_STORAGE_KEY, code);
    writeCityCookie(code);
    if (persist) persistCityCode(code);
  }, []);

  /** Manual selection. The travel-plan form is the only place that calls this. */
  const setCityCode = useCallback(
    (code: CityCode) => {
      applyCityCode(code, { persist: true });
    },
    [applyCityCode]
  );

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationStatus("unsupported");
      return;
    }

    setLocationStatus("detecting");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const match = nearestCity(position.coords.latitude, position.coords.longitude);
        if (match) {
          applyCityCode(match.code, { persist: true });
          setLocationStatus("granted");
        } else {
          // Position resolved, but nowhere near a supported city — location
          // sharing is on, so say so, without guessing a city that is wrong.
          setLocationStatus("unresolved");
        }
      },
      (error) => {
        setLocationStatus(error.code === error.PERMISSION_DENIED ? "denied" : "unresolved");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 }
    );
  }, [applyCityCode]);

  // Auto-detect ONLY when the browser says permission was already granted in
  // an earlier visit — never prompts, never interrupts someone who has not
  // opted in. If permission is merely "prompt" or the Permissions API is
  // unavailable, the stored/manually-chosen city is used as-is, and location
  // stays available on request via requestLocation().
  useEffect(() => {
    if (detectStartedRef.current) return;
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return;

    let cancelled = false;

    navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        if (cancelled) return;
        if (status.state === "granted" && !detectStartedRef.current) {
          detectStartedRef.current = true;
          requestLocation();
        }
      })
      .catch(() => {
        // Permissions API can refuse to answer (some browsers, some
        // contexts) — that is not an error, just no auto-detect this time.
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<CityContextValue>(
    () => ({ city: getCity(cityCode), cityCode, setCityCode, ready, locationStatus, requestLocation }),
    [cityCode, setCityCode, ready, locationStatus, requestLocation]
  );

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}

/** Hook for any component that needs the currently selected city. */
export function useCity(): CityContextValue {
  const context = useContext(CityContext);

  if (!context) {
    throw new Error("useCity() must be used inside <CityProvider>.");
  }

  return context;
}

/** Exported so server code can read the same cookie name. */
export { CITY_COOKIE_NAME };
