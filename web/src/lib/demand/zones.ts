/**
 * Demand zones.
 *
 * WHAT A ZONE IS HERE
 * CityFlow AI asks people for an AREA ("Salt Lake Sector 5"), not an address.
 * A zone is simply that area name, normalised so that "Salt Lake Sector 5",
 * "salt lake sector 5" and "Salt-Lake  Sector 5" all become one bucket.
 *
 * WHY NOT REAL GEOGRAPHIC ZONES
 * Proper traffic-analysis zones come from a city's own transport authority, or
 * are cut from the road network. CityFlow AI has neither yet. Pretending to
 * have them — by inventing a grid, say — would put a fake precision on every
 * number in the Admin Portal. A normalised area name is coarse, but it is real:
 * it is exactly what the person told us, and nothing more.
 *
 * WHERE REAL ZONES PLUG IN
 * `toZoneKey()` is the only place that decides what a zone is. Swapping it for
 * a lookup against an official zone boundary set changes one function.
 */

/**
 * Turns a free-text area into a stable zone key.
 *
 *   "Salt Lake  Sector-5!" -> "salt-lake-sector-5"
 */
export function toZoneKey(area: string): string {
  return (
    area
      .trim()
      .toLowerCase()
      // Anything that is not a letter, digit or space becomes a space.
      .replace(/[^a-z0-9\s]/g, " ")
      // Collapse runs of whitespace.
      .replace(/\s+/g, " ")
      .trim()
      .replace(/ /g, "-")
      // Guard against an absurdly long key reaching the database.
      .slice(0, 80) || "unknown"
  );
}

/**
 * Turns a zone key back into something readable for the UI.
 *
 *   "salt-lake-sector-5" -> "Salt Lake Sector 5"
 *
 * Used where only the key is available (aggregated tables never store the
 * original text).
 */
export function zoneKeyToLabel(zoneKey: string): string {
  return zoneKey
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
