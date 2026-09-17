import { pool } from "@/lib/db";

export interface Impact {
  journeysPlanned: number;
  minutesShifted: number;
  /** Segment-arrivals moved off a road that was already at its limit. */
  roadsSpared: number;
  defectsConfirmed: number;
  points: number;
}

interface Row {
  journeys: string;
  minutes: string;
  roads_spared: string;
  defects: string;
  points: string;
}

/**
 * What this traveller's own shifts have added up to.
 *
 * Every figure comes from a row that was written when a decision was made, not from a
 * counter incremented alongside it: the recommendations are the record. Defects are
 * counted through points_ledger rather than road_anomalies, because an anomaly is
 * deliberately not linked to whoever recorded it and there is no way back from one to
 * a person, which is the property that makes reporting safe.
 */
export async function travellerImpact(identityId: string): Promise<Impact> {
  const { rows } = await pool().query<Row>(
    `SELECT
        (SELECT count(*) FROM trips t WHERE t.identity_id = $1) AS journeys,
        (SELECT coalesce(sum(abs(r.shift_minutes)), 0)
           FROM recommendations r
           JOIN trips t ON t.id = r.trip_id
          WHERE t.identity_id = $1) AS minutes,
        (SELECT coalesce(sum(greatest(r.roads_over_at_usual - r.roads_over_at_plan, 0)), 0)
           FROM recommendations r
           JOIN trips t ON t.id = r.trip_id
          WHERE t.identity_id = $1) AS roads_spared,
        (SELECT count(*) FROM points_ledger p
          WHERE p.identity_id = $1 AND p.source = 'defect_confirmed') AS defects,
        (SELECT coalesce(sum(p.points), 0) FROM points_ledger p
          WHERE p.identity_id = $1) AS points`,
    [identityId],
  );

  const row = rows[0];
  return {
    journeysPlanned: Number(row?.journeys ?? 0),
    minutesShifted: Number(row?.minutes ?? 0),
    roadsSpared: Number(row?.roads_spared ?? 0),
    defectsConfirmed: Number(row?.defects ?? 0),
    points: Number(row?.points ?? 0),
  };
}
