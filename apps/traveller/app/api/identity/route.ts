import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { hashSecret } from "@cityflow/secrets";
import { clearSession, issueSession, readSession } from "@/lib/session";
import { CITY_CODE_PATTERN, isValidCityId, isValidRecoveryCode } from "@/lib/city-id";

const UNIQUE_VIOLATION = "23505";

interface CreateBody {
  cityId: string;
  recoveryCode: string;
  homeCity: string;
}

function parse(body: unknown): CreateBody | null {
  if (typeof body !== "object" || body === null) return null;
  const { cityId, recoveryCode, homeCity } = body as Record<string, unknown>;

  if (typeof cityId !== "string" || !isValidCityId(cityId)) return null;
  if (typeof recoveryCode !== "string" || !isValidRecoveryCode(recoveryCode)) return null;
  if (typeof homeCity !== "string" || !CITY_CODE_PATTERN.test(homeCity)) return null;
  if (!cityId.startsWith(`${homeCity}-`)) return null;

  return { cityId, recoveryCode, homeCity };
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const parsed = parse(body);
  if (!parsed) {
    return NextResponse.json(
      { error: "Malformed City ID or recovery code." },
      { status: 400 },
    );
  }

  const recoveryHash = await hashSecret(parsed.recoveryCode);

  try {
    const result = await pool().query<{ id: string }>(
      `INSERT INTO city_identities (public_id, recovery_hash, home_city)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [parsed.cityId, recoveryHash, parsed.homeCity],
    );

    const identityId = result.rows[0]!.id;
    await issueSession({ identityId, cityId: parsed.cityId });

    return NextResponse.json({ cityId: parsed.cityId }, { status: 201 });
  } catch (error) {
    // The browser picked an ID that is already taken. It generates another and
    // retries; nothing about the collision is the traveller's problem.
    if (isPostgresError(error) && error.code === UNIQUE_VIOLATION) {
      return NextResponse.json({ error: "City ID already taken." }, { status: 409 });
    }
    throw error;
  }
}

function isPostgresError(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error;
}

/**
 * Deletes the account and everything hanging off it.
 *
 * The schema does the work: routines, trips and points cascade from city_identities,
 * so there is no list of tables here to fall out of date as the product grows. Road
 * anomalies are deliberately not tied to the identity that recorded them, so they are
 * not reachable from here and nothing that reports a pothole can be traced back by
 * deleting the reporter.
 */
export async function DELETE(): Promise<NextResponse> {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  await pool().query(`DELETE FROM city_identities WHERE id = $1`, [session.identityId]);
  await clearSession();

  return NextResponse.json({ deleted: true });
}
