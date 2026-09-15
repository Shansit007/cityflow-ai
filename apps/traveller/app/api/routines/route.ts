import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { readSession } from "@/lib/session";
import { isCell } from "@/lib/geohash";

const MODES = ["car", "two_wheeler", "bus", "metro", "walk", "cycle"] as const;
type Mode = (typeof MODES)[number];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_LABEL = 60;

interface RoutineBody {
  label: string;
  originCell: string;
  destinationCell: string;
  days: number[];
  arriveBy: string;
  mode: Mode;
}

function parse(body: unknown): RoutineBody | null {
  if (typeof body !== "object" || body === null) return null;
  const { label, originCell, destinationCell, days, arriveBy, mode } = body as Record<
    string,
    unknown
  >;

  if (typeof label !== "string" || !label.trim() || label.length > MAX_LABEL) return null;
  if (typeof originCell !== "string" || !isCell(originCell)) return null;
  if (typeof destinationCell !== "string" || !isCell(destinationCell)) return null;
  if (typeof arriveBy !== "string" || !TIME_PATTERN.test(arriveBy)) return null;
  if (typeof mode !== "string" || !MODES.includes(mode as Mode)) return null;

  if (!Array.isArray(days) || days.length === 0) return null;
  if (new Set(days).size !== days.length) return null;
  if (!days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)) return null;

  return {
    label: label.trim(),
    originCell,
    destinationCell,
    days: [...(days as number[])].sort(),
    arriveBy,
    mode: mode as Mode,
  };
}

export async function GET(): Promise<NextResponse> {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const result = await pool().query(
    `SELECT id, label, origin_cell, destination_cell, days_of_week, arrive_by, mode
       FROM routines
      WHERE identity_id = $1
      ORDER BY arrive_by`,
    [session.identityId],
  );

  return NextResponse.json({ routines: result.rows });
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

  const routine = parse(body);
  if (!routine) {
    return NextResponse.json({ error: "That routine is not valid." }, { status: 400 });
  }

  const result = await pool().query<{ id: string }>(
    `INSERT INTO routines
       (identity_id, label, origin_cell, destination_cell, days_of_week, arrive_by, mode)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      session.identityId,
      routine.label,
      routine.originCell,
      routine.destinationCell,
      routine.days,
      routine.arriveBy,
      routine.mode,
    ],
  );

  return NextResponse.json({ id: result.rows[0]!.id }, { status: 201 });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Which routine?" }, { status: 400 });

  // Scoped to the session's identity, so knowing another routine's id is not enough
  // to delete it.
  const result = await pool().query(
    `DELETE FROM routines WHERE id = $1 AND identity_id = $2`,
    [id, session.identityId],
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "No such routine." }, { status: 404 });
  }

  return NextResponse.json({ deleted: id });
}
