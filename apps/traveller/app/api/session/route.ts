import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { verifyRecoveryCode } from "@/lib/recovery";
import { clearSession, issueSession } from "@/lib/session";
import { isValidCityId, normaliseRecoveryCode } from "@/lib/city-id";

/**
 * One response for every failure. A caller cannot learn whether a City ID exists,
 * which is the difference between "your data is anonymous" and "your data is
 * anonymous unless someone guesses at the login form".
 */
const REJECTED = { error: "That City ID and recovery code do not match." };

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const { cityId, recoveryCode } = (body ?? {}) as Record<string, unknown>;

  if (typeof cityId !== "string" || typeof recoveryCode !== "string") {
    return NextResponse.json(REJECTED, { status: 401 });
  }
  if (!isValidCityId(cityId)) {
    return NextResponse.json(REJECTED, { status: 401 });
  }

  const result = await pool().query<{ id: string; recovery_hash: string }>(
    `SELECT id, recovery_hash FROM city_identities WHERE public_id = $1`,
    [cityId],
  );

  const row = result.rows[0];
  if (!row) {
    return NextResponse.json(REJECTED, { status: 401 });
  }

  const matches = await verifyRecoveryCode(
    normaliseRecoveryCode(recoveryCode),
    row.recovery_hash,
  );
  if (!matches) {
    return NextResponse.json(REJECTED, { status: 401 });
  }

  await issueSession({ identityId: row.id, cityId });
  return NextResponse.json({ cityId });
}

export async function DELETE(): Promise<NextResponse> {
  await clearSession();
  return NextResponse.json({ signedOut: true });
}
