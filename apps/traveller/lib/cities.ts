export interface City {
  code: string;
  name: string;
  state: string;
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
  { code: "BLR", name: "Bengaluru", state: "Karnataka" },
  { code: "BOM", name: "Mumbai", state: "Maharashtra" },
  { code: "DEL", name: "Delhi", state: "Delhi" },
  { code: "HYD", name: "Hyderabad", state: "Telangana" },
  { code: "MAA", name: "Chennai", state: "Tamil Nadu" },
  { code: "PNQ", name: "Pune", state: "Maharashtra" },
  { code: "CCU", name: "Kolkata", state: "West Bengal" },
  { code: "AMD", name: "Ahmedabad", state: "Gujarat" },
  { code: "JAI", name: "Jaipur", state: "Rajasthan" },
];

export const DEFAULT_CITY = "BLR";

export function cityByCode(code: string): City | undefined {
  return CITIES.find((city) => city.code === code);
}
