import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";

/**
 * GET /api/geocode?q=park+street&city=kolkata
 *
 * Place search for the map, powered by OpenStreetMap's Nominatim service.
 *
 * WHY THIS GOES THROUGH OUR SERVER
 * Nominatim is free but has a usage policy: identify yourself, keep the request
 * rate low, and cache results. A browser calling it directly would send one
 * request per keystroke from every visitor, with no shared cache and no way to
 * identify the application. Routing it through here lets us do all three.
 *
 * It is also why this endpoint requires a signed-in user: it stops the search
 * from being used as an open proxy.
 */

export const runtime = "nodejs";

/** Identifies CityFlow AI to Nominatim, as their usage policy requires. */
const USER_AGENT = "CityFlowAI/0.2 (academic capstone project; traffic demand research)";

/** Results are cached in memory so repeated searches cost nothing. */
const CACHE_TTL_MS = 1000 * 60 * 60; // one hour
const MAX_CACHE_ENTRIES = 300;

interface CacheEntry {
  expiresAt: number;
  results: GeocodeResult[];
}

const cache = new Map<string, CacheEntry>();

export interface GeocodeResult {
  label: string;
  lat: number;
  lon: number;
}

/** Nominatim asks for no more than one request per second. */
let lastRequestAt = 0;
const MIN_REQUEST_GAP_MS = 1100;

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();
  const city = (searchParams.get("city") ?? "").trim();

  if (query.length < 3) {
    return NextResponse.json({ results: [] });
  }

  // Bias the search towards the city the user is looking at.
  const fullQuery = city ? `${query}, ${city}, India` : `${query}, India`;
  const cacheKey = fullQuery.toLowerCase();

  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ results: cached.results, cached: true });
  }

  // Politely space out requests to the shared free service.
  const sinceLast = Date.now() - lastRequestAt;
  if (sinceLast < MIN_REQUEST_GAP_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_GAP_MS - sinceLast));
  }
  lastRequestAt = Date.now();

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", fullQuery);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "5");
    url.searchParams.set("countrycodes", "in");

    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      // Never let a slow third party hang our own request.
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { results: [], error: "Place search is unavailable right now." },
        { status: 200 }
      );
    }

    const raw = (await response.json()) as Array<{
      display_name?: string;
      lat?: string;
      lon?: string;
    }>;

    const results: GeocodeResult[] = raw
      .filter((item) => item.lat && item.lon && item.display_name)
      .map((item) => ({
        label: item.display_name!,
        lat: Number(item.lat),
        lon: Number(item.lon),
      }));

    // Keep the cache from growing without bound.
    if (cache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, results });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[geocode] failed:", error);
    // A failed search must never break the map — return an empty list.
    return NextResponse.json({
      results: [],
      error: "Place search is unavailable right now.",
    });
  }
}
