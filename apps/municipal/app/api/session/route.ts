import { NextResponse } from "next/server";
import { verifySecret } from "@cityflow/secrets";

import { pool } from "@/lib/db";
import { clearSession, issueSession, type Role } from "@/lib/session";

/**
 * One response for every failure, so the form cannot be used to find out which email
 * addresses belong to council staff.
 */
const REJECTED = { error: "That email and password do not match." };

interface StaffRow {
  id: string;
  city: string;
  role: Role;
  display_name: string;
  password_hash: string;
  active: boolean;
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const { email, password } = (body ?? {}) as Record<string, unknown>;
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json(REJECTED, { status: 401 });
  }

  const result = await pool().query<StaffRow>(
    `SELECT id, city, role, display_name, password_hash, active
       FROM municipal_users
      WHERE email = $1`,
    [email.trim()],
  );

  const staff = result.rows[0];
  if (!staff) {
    return NextResponse.json(REJECTED, { status: 401 });
  }

  const matches = await verifySecret(password, staff.password_hash);
  if (!matches) {
    return NextResponse.json(REJECTED, { status: 401 });
  }

  // Checked after the password, so a deactivated account cannot be told apart from a
  // wrong password by how quickly the answer comes back.
  if (!staff.active) {
    return NextResponse.json(REJECTED, { status: 401 });
  }

  await issueSession({
    userId: staff.id,
    city: staff.city,
    role: staff.role,
    displayName: staff.display_name,
  });

  return NextResponse.json({ displayName: staff.display_name, role: staff.role });
}

export async function DELETE(): Promise<NextResponse> {
  await clearSession();
  return NextResponse.json({ signedOut: true });
}
