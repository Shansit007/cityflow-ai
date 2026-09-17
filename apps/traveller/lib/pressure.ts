import { pool } from "@/lib/db";
import { INDIA_TIME_ZONE } from "@/lib/localtime";

/**
 * Capacity in departure_slots is per hour, and a window is a quarter of one.
 * Dividing here rather than storing the per-window figure keeps one definition of
 * capacity in the database, the one road_segments already publishes.
 */
const WINDOWS_PER_HOUR = 4;

export interface Window {
  /** Local clock label, e.g. "08:45". */
  at: string;
  startsAt: Date;
  /** Segments carrying more vehicles than the window can absorb. */
  over: number;
  /** Segments with a figure at all, which is the denominator that matters. */
  measured: number;
}

export interface Pressure {
  windows: Window[];
  /** The window covering now, or null when nothing is loaded for today. */
  now: Window | null;
  busiest: { segment: string; ratio: number } | null;
  segmentsLoaded: number;
}

interface WindowRow {
  window_start: string;
  over: string;
  measured: string;
}

interface BusiestRow {
  osm_way_id: string;
  ratio: string;
}

const CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: INDIA_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function quarterHour(at: Date): Date {
  const ms = 15 * 60 * 1000;
  return new Date(Math.floor(at.getTime() / ms) * ms);
}

/**
 * How loaded the city's network is across today's measured windows.
 *
 * Read from departure_slots, which is the same ledger the allocator plans against, so
 * what a traveller sees here and what the engine is avoiding are the same numbers
 * rather than two estimates that drift.
 */
export async function cityPressure(
  city: string,
  at: Date = new Date(),
): Promise<Pressure> {
  const dayStart = new Date(at);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 36 * 60 * 60 * 1000);

  const [windows, busiest, loaded] = await Promise.all([
    pool().query<WindowRow>(
      `SELECT s.window_start,
              count(*) FILTER (
                WHERE s.background_load + s.allocated > s.capacity::numeric / $1
              ) AS over,
              count(*) AS measured
         FROM departure_slots s
        WHERE s.window_start >= $2 AND s.window_start < $3
        GROUP BY s.window_start
        ORDER BY s.window_start`,
      [WINDOWS_PER_HOUR, dayStart, dayEnd],
    ),
    pool().query<BusiestRow>(
      `SELECT r.osm_way_id,
              (s.background_load + s.allocated) / (s.capacity::numeric / $1) AS ratio
         FROM departure_slots s
         JOIN road_segments r ON r.id = s.segment_id
        WHERE s.window_start >= $2 AND s.window_start < $3 AND r.city = $4
        ORDER BY ratio DESC
        LIMIT 1`,
      [WINDOWS_PER_HOUR, dayStart, dayEnd, city],
    ),
    pool().query<{ count: string }>(
      `SELECT count(*) AS count FROM road_segments WHERE city = $1`,
      [city],
    ),
  ]);

  const parsed: Window[] = windows.rows.map((row) => {
    const startsAt = new Date(row.window_start);
    return {
      at: CLOCK.format(startsAt),
      startsAt,
      over: Number(row.over),
      measured: Number(row.measured),
    };
  });

  const current = quarterHour(at).getTime();

  return {
    windows: parsed,
    now: parsed.find((window) => window.startsAt.getTime() === current) ?? null,
    busiest: busiest.rows[0]
      ? {
          segment: busiest.rows[0].osm_way_id,
          ratio: Number(busiest.rows[0].ratio),
        }
      : null,
    segmentsLoaded: Number(loaded.rows[0]?.count ?? 0),
  };
}
