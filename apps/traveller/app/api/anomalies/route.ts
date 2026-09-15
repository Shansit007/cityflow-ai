import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { readSession } from "@/lib/session";

const MAX_BATCH = 200;

interface Reading {
  lat: number;
  lon: number;
  magnitude: number;
  features: Record<string, unknown>;
  recordedAt: string;
}

function parse(raw: unknown): Reading | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { lat, lon, magnitude, features, recordedAt } = raw as Record<string, unknown>;

  if (typeof lat !== "number" || !Number.isFinite(lat) || Math.abs(lat) > 90) return null;
  if (typeof lon !== "number" || !Number.isFinite(lon) || Math.abs(lon) > 180)
    return null;
  if (typeof magnitude !== "number" || magnitude < 0 || magnitude > 1) return null;
  if (typeof features !== "object" || features === null) return null;
  if (typeof recordedAt !== "string" || Number.isNaN(Date.parse(recordedAt))) return null;

  return {
    lat,
    lon,
    magnitude,
    features: features as Record<string, unknown>,
    recordedAt,
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const { readings } = (body ?? {}) as Record<string, unknown>;
  if (!Array.isArray(readings) || readings.length === 0) {
    return NextResponse.json({ error: "No readings sent." }, { status: 400 });
  }
  if (readings.length > MAX_BATCH) {
    return NextResponse.json({ error: "Too many readings at once." }, { status: 413 });
  }

  const parsed = readings.map(parse);
  if (parsed.some((reading) => reading === null)) {
    return NextResponse.json({ error: "A reading is malformed." }, { status: 400 });
  }

  const city = session.cityId.slice(0, 3);
  const client = await pool().connect();

  try {
    await client.query("BEGIN");

    for (const reading of parsed as Reading[]) {
      await client.query(
        `INSERT INTO road_anomalies
           (city, identity_id, location, magnitude, features, recorded_at)
         VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $5, $6, $7)`,
        [
          city,
          session.identityId,
          reading.lon,
          reading.lat,
          reading.magnitude,
          JSON.stringify(reading.features),
          reading.recordedAt,
        ],
      );
    }

    // Promotion runs in the same transaction as the insert, so a reading is never
    // visible as unaggregated-and-already-counted, and a failure leaves neither.
    const promoted = await client.query<{ promote_anomalies: number }>(
      `SELECT promote_anomalies($1)`,
      [city],
    );

    await client.query("COMMIT");

    return NextResponse.json(
      { accepted: parsed.length, defectsCreated: promoted.rows[0]!.promote_anomalies },
      { status: 201 },
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
