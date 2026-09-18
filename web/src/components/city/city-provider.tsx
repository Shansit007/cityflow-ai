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

import { DEFAULT_CITY_CODE, getCity, type City, type CityCode } from "@/lib/cities";

/**
 * Selected city.
 *
 * The chosen city drives:
 *   - the wording in the header and hero
 *   - the illustrated backdrop
 *   - (from Phase 2) the map centre and the traffic/demand data that is loaded
 *
 * It is stored twice on purpose:
 *   - localStorage  so the browser remembers it instantly on the next visit
 *   - a cookie      so the SERVER can also read it when rendering a page
 */

const CITY_STORAGE_KEY = "cityflow-city";
const CITY_COOKIE_NAME = "cityflow_city";
const CITY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // one year

interface CityContextValue {
  city: City;
  cityCode: CityCode;
  setCityCode: (code: CityCode) => void;
  /** False until the saved city has been read from the browser. */
  ready: boolean;
}

const CityContext = createContext<CityContextValue | null>(null);

/** Writes the city cookie so server components can read the same value. */
function writeCityCookie(code: CityCode) {
  document.cookie = `${CITY_COOKIE_NAME}=${code}; path=/; max-age=${CITY_COOKIE_MAX_AGE}; samesite=lax`;
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

  // Read the saved preference once, on the client.
  useEffect(() => {
    const stored = window.localStorage.getItem(CITY_STORAGE_KEY);
    const resolved = getCity(stored ?? initialCityCode).code;

    setCityCodeState(resolved);
    writeCityCookie(resolved);
    setReady(true);
  }, [initialCityCode]);

  const setCityCode = useCallback((code: CityCode) => {
    setCityCodeState(code);
    window.localStorage.setItem(CITY_STORAGE_KEY, code);
    writeCityCookie(code);
  }, []);

  const value = useMemo<CityContextValue>(
    () => ({ city: getCity(cityCode), cityCode, setCityCode, ready }),
    [cityCode, setCityCode, ready]
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
