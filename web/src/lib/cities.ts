/**
 * CityFlow AI — supported cities.
 *
 * This is the single source of truth for city identity across the product:
 * the city selector, the visual backdrop, the map centre (used from Phase 2)
 * and the zone naming used by the demand engine (Phase 3+).
 *
 * Adding a new city = adding one entry here + one skyline drawing in
 * `src/components/city/city-skyline.tsx`.
 */

/** Identifier used in URLs, the database and the API. Always lower-case. */
export type CityCode =
  | "delhi"
  | "bengaluru"
  | "mumbai"
  | "hyderabad"
  | "pune"
  | "bhopal"
  | "chennai"
  | "kolkata";

export interface City {
  /** Stable machine identifier. */
  code: CityCode;
  /** Name shown to the user. */
  name: string;
  /** State / union territory, shown as a small caption in the selector. */
  state: string;
  /**
   * Short phrase describing the visual identity used for this city.
   * Shown as alternative text so the illustration is meaningful to screen readers.
   */
  landmark: string;
  /** Map centre, used by the Leaflet map from Phase 2 onwards. */
  center: { lat: number; lng: number };
  /** Sensible default map zoom for this city. */
  zoom: number;
  /** Shown as a search keyword so "blr", "bangalore" etc. still find the city. */
  aliases: string[];
  /** Marked as popular so it appears in the quick-pick row of the selector. */
  popular: boolean;
}

/**
 * All supported cities, in the order they appear in the "popular" row.
 * Coordinates are approximate city centres.
 */
export const CITIES: City[] = [
  {
    code: "delhi",
    name: "Delhi",
    state: "Delhi (NCT)",
    landmark: "India Gate and the Rajpath corridor",
    center: { lat: 28.6139, lng: 77.209 },
    zoom: 11,
    aliases: ["new delhi", "ncr", "dilli"],
    popular: true,
  },
  {
    code: "bengaluru",
    name: "Bengaluru",
    state: "Karnataka",
    landmark: "tech-park towers along a tree-lined arterial road",
    center: { lat: 12.9716, lng: 77.5946 },
    zoom: 11,
    aliases: ["bangalore", "blr", "bengaluru city"],
    popular: true,
  },
  {
    code: "hyderabad",
    name: "Hyderabad",
    state: "Telangana",
    landmark: "the Charminar beside modern city towers",
    center: { lat: 17.385, lng: 78.4867 },
    zoom: 11,
    aliases: ["hyd", "secunderabad", "cyberabad"],
    popular: true,
  },
];

/*
 * Mumbai, Pune, Bhopal, Chennai and Kolkata were trimmed from the selectable
 * list (kept to Delhi, Bengaluru and Hyderabad "for now") to cut down on
 * city-picker clutter. Their supporting per-city data (skyline art, demand
 * model tuning, zone cells, geocode bounding boxes) was intentionally left in
 * place rather than deleted -- it is simply unused while the city isn't in
 * this array, and re-adding one of these cities later is just adding its
 * entry back here.
 */

/** The city selected for a brand-new visitor who has not chosen one yet. */
export const DEFAULT_CITY_CODE: CityCode = "delhi";

/** Fast lookup table: city code -> city. */
const CITY_BY_CODE = new Map<string, City>(CITIES.map((city) => [city.code, city]));

/**
 * Returns the city for a code, falling back to the default city if the code is
 * unknown, empty or comes from an old bookmark.
 */
export function getCity(code: string | null | undefined): City {
  if (!code) return CITY_BY_CODE.get(DEFAULT_CITY_CODE)!;
  return CITY_BY_CODE.get(code.toLowerCase()) ?? CITY_BY_CODE.get(DEFAULT_CITY_CODE)!;
}

/** True when the given string is a supported city code. */
export function isCityCode(value: string): value is CityCode {
  return CITY_BY_CODE.has(value.toLowerCase());
}

/**
 * Filters cities by a free-text query, matching the name, the state or any alias.
 * An empty query returns every city.
 */
export function searchCities(query: string): City[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return CITIES;

  return CITIES.filter((city) => {
    const haystack = [city.name, city.state, ...city.aliases].join(" ").toLowerCase();
    return haystack.includes(q);
  });
}
