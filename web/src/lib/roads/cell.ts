/**
 * Geographic merging of road reports.
 *
 * THE PROBLEM
 * Twenty people drive over the same pothole. Their phones record twenty
 * slightly different coordinates, because GPS on a moving vehicle is accurate
 * to somewhere between five and thirty metres. If each one created its own row,
 * the map would show twenty "possible potholes" in a smear along the road, and
 * the evidence for the real one would be split twenty ways — the exact opposite
 * of what more reports should do.
 *
 * THE APPROACH
 * Round every coordinate onto a small grid and use the grid cell as the merge
 * key. Reports that land in the same cell, about the same kind of problem, are
 * treated as the same problem.
 *
 * CHOOSING THE CELL SIZE
 * Too small and real agreement gets split across neighbouring cells. Too large
 * and two genuinely different potholes fifty metres apart become one. At Indian
 * latitudes 0.0005° is roughly 55 m north-south and 48-53 m east-west, which is
 * a little larger than typical GPS error and smaller than the distance between
 * separate defects on a street. That is the compromise.
 *
 * WHAT THIS IS NOT
 * This is not map-matching. A proper implementation would snap each report to a
 * road segment in the OpenStreetMap network, so that a report on a flyover is
 * not merged with one on the road beneath it. A grid cannot tell those apart,
 * and this file is the single place that would change if snapping were added.
 */

/** Grid step in degrees — roughly 50 m at Indian latitudes. */
export const CELL_DEGREES = 0.0005;

/**
 * Rounds one coordinate onto the grid.
 * Fixed to 4 decimal places so the key is stable no matter how floating point
 * rounds the multiplication.
 */
function snap(value: number): string {
  return (Math.round(value / CELL_DEGREES) * CELL_DEGREES).toFixed(4);
}

/**
 * Builds the merge key for a report.
 *
 * With coordinates: a grid cell, e.g. `"geo:22.7195:75.8577"`.
 * Without coordinates: the area name, e.g. `"zone:kolkata:salt-lake-sector-5"`.
 *
 * A report with no location is still worth having — somebody typing "the road
 * outside Salt Lake Sector 5 metro station is flooded" is real information —
 * but it can only be merged at area level, and the UI says so.
 */
export function cellKeyFor(options: {
  cityCode: string;
  zoneKey: string;
  lat?: number | null;
  lng?: number | null;
}): string {
  const { cityCode, zoneKey, lat, lng } = options;

  if (typeof lat === "number" && typeof lng === "number" && isPlausibleCoordinate(lat, lng)) {
    return `geo:${snap(lat)}:${snap(lng)}`;
  }

  return `zone:${cityCode}:${zoneKey}`;
}

/** True when the cell key came from real coordinates rather than an area name. */
export function cellIsPrecise(cellKey: string): boolean {
  return cellKey.startsWith("geo:");
}

/**
 * Rejects coordinates that cannot be right.
 *
 * A browser that fails to get a fix sometimes reports 0,0 — a point in the
 * Atlantic that would otherwise become a permanent phantom road issue. The
 * bounds are a generous box around India; a report from outside it is far more
 * likely to be a bug than a genuine trip.
 */
export function isPlausibleCoordinate(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98;
}

/**
 * Straight-line distance between two points in metres (equirectangular
 * approximation — accurate to well under a percent over city distances, and far
 * cheaper than haversine).
 *
 * Used to answer "is this road issue near me?", never to measure a journey.
 */
export function approximateDistanceMetres(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const EARTH_RADIUS_M = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const meanLat = toRad((a.lat + b.lat) / 2);
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng) * Math.cos(meanLat);

  return Math.round(Math.sqrt(dLat * dLat + dLng * dLng) * EARTH_RADIUS_M);
}
