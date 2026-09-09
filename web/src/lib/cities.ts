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
    code: "mumbai",
    name: "Mumbai",
    state: "Maharashtra",
    landmark: "the Marine Drive curve against the city skyline",
    center: { lat: 19.076, lng: 72.8777 },
    zoom: 11,
    aliases: ["bombay", "mum", "navi mumbai"],
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
  {
    code: "pune",
    name: "Pune",
    state: "Maharashtra",
    landmark: "green hills behind a wide urban road",
    center: { lat: 18.5204, lng: 73.8567 },
    zoom: 11,
    aliases: ["poona", "pimpri", "chinchwad"],
    popular: true,
  },
  {
    code: "bhopal",
    name: "Bhopal",
    state: "Madhya Pradesh",
    landmark: "the Upper Lake with a green city edge",
    center: { lat: 23.2599, lng: 77.4126 },
    zoom: 11,
    aliases: ["bhopaal", "city of lakes"],
    popular: true,
  },
  {
    code: "chennai",
    name: "Chennai",
    state: "Tamil Nadu",
    landmark: "the Marina coastline and lighthouse",
    center: { lat: 13.0827, lng: 80.2707 },
    zoom: 11,
    aliases: ["madras", "maa"],
    popular: true,
  },
  {
    code: "kolkata",
    name: "Kolkata",
    state: "West Bengal",
    landmark: "the Howrah Bridge over the river",
    center: { lat: 22.5726, lng: 88.3639 },
    zoom: 11,
    aliases: ["calcutta", "ccu", "howrah"],
    popular: true,
  },
];

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
