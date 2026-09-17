export interface City {
  code: string;
  name: string;
  state: string;
  /** Where a map of this city opens. Matches services/engine/core/cities.py. */
  centre: { lat: number; lon: number };
}

/**
 * Cities the traveller app offers, keyed by IATA code because that is already the
 * convention in the engine and on the City ID itself. A city is listed here only if
 * `infra/migrations/0004_seed_cities.sql` seeds it, since a City ID references one.
 *
 * Listing a city is not a claim that its road network has been loaded. Only Bengaluru
 * has been; the rest can hold routines and produce recommendations once their extract
 * is loaded, and docs/architecture.md says what that involves.
 */
export const CITIES: readonly City[] = [
  {
    code: "BLR",
    name: "Bengaluru",
    state: "Karnataka",
    centre: { lat: 12.9716, lon: 77.5946 },
  },
  {
    code: "BOM",
    name: "Mumbai",
    state: "Maharashtra",
    centre: { lat: 19.076, lon: 72.8777 },
  },
  { code: "DEL", name: "Delhi", state: "Delhi", centre: { lat: 28.6139, lon: 77.209 } },
  {
    code: "HYD",
    name: "Hyderabad",
    state: "Telangana",
    centre: { lat: 17.385, lon: 78.4867 },
  },
  {
    code: "MAA",
    name: "Chennai",
    state: "Tamil Nadu",
    centre: { lat: 13.0827, lon: 80.2707 },
  },
  {
    code: "PNQ",
    name: "Pune",
    state: "Maharashtra",
    centre: { lat: 18.5204, lon: 73.8567 },
  },
  {
    code: "CCU",
    name: "Kolkata",
    state: "West Bengal",
    centre: { lat: 22.5726, lon: 88.3639 },
  },
  {
    code: "AMD",
    name: "Ahmedabad",
    state: "Gujarat",
    centre: { lat: 23.0225, lon: 72.5714 },
  },
  {
    code: "JAI",
    name: "Jaipur",
    state: "Rajasthan",
    centre: { lat: 26.9124, lon: 75.7873 },
  },
];

export const DEFAULT_CITY = "BLR";

export function cityByCode(code: string): City | undefined {
  return CITIES.find((city) => city.code === code);
}
