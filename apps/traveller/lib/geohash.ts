const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/** Matches the geohash_cell domain in infra/migrations/0001_init.sql. */
export const CELL_PRECISION = 6;
export const CELL_PATTERN = /^[0-9bcdefghjkmnpqrstuvwxyz]{6}$/;

export interface Cell {
  hash: string;
  south: number;
  north: number;
  west: number;
  east: number;
}

/**
 * The geohash cell a point falls in, and that cell's edges.
 *
 * Coarsening happens here, in the browser, and the exact coordinate is never sent
 * anywhere. Six characters is about 1.2 km by 0.6 km at Indian latitudes, which is
 * enough to route between neighbourhoods and not enough to place anyone at a door.
 * docs/privacy.md sets out what that does and does not protect against.
 */
export function cellFor(lat: number, lon: number, precision = CELL_PRECISION): Cell {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new RangeError(`Latitude out of range: ${lat}`);
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new RangeError(`Longitude out of range: ${lon}`);
  }

  let south = -90;
  let north = 90;
  let west = -180;
  let east = 180;

  let hash = "";
  let bits = 0;
  let bitCount = 0;
  let splittingLongitude = true;

  while (hash.length < precision) {
    if (splittingLongitude) {
      const middle = (west + east) / 2;
      if (lon >= middle) {
        bits = (bits << 1) + 1;
        west = middle;
      } else {
        bits = bits << 1;
        east = middle;
      }
    } else {
      const middle = (south + north) / 2;
      if (lat >= middle) {
        bits = (bits << 1) + 1;
        south = middle;
      } else {
        bits = bits << 1;
        north = middle;
      }
    }

    splittingLongitude = !splittingLongitude;
    bitCount += 1;

    if (bitCount === 5) {
      hash += BASE32[bits]!;
      bits = 0;
      bitCount = 0;
    }
  }

  return { hash, south, north, west, east };
}

const METRES_PER_DEGREE = 111_320;

/** Cell size in metres, for showing a traveller how coarse the stored location is. */
export function cellSize(cell: Cell): { width: number; height: number } {
  const midLatitude = ((cell.south + cell.north) / 2) * (Math.PI / 180);
  return {
    width: Math.round(
      (cell.east - cell.west) * METRES_PER_DEGREE * Math.cos(midLatitude),
    ),
    height: Math.round((cell.north - cell.south) * METRES_PER_DEGREE),
  };
}

export function isCell(value: string): boolean {
  return CELL_PATTERN.test(value);
}
