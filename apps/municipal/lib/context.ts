import { redirect } from "next/navigation";

import { pool } from "./db";
import { confirmationThreshold } from "./defects";
import { readSession, type StaffSession } from "./session";

export interface StaffContext {
  session: StaffSession;
  threshold: number;
  cityName: string;
}

/** Everything every page in this dashboard needs before it can render anything. */
export async function staffContext(): Promise<StaffContext> {
  const session = await readSession();
  if (!session) redirect("/login");

  const [threshold, name] = await Promise.all([
    confirmationThreshold(session.city),
    cityName(session.city),
  ]);

  return { session, threshold, cityName: name };
}

async function cityName(code: string): Promise<string> {
  const result = await pool().query<{ name: string }>(
    `SELECT name FROM cities WHERE code = $1`,
    [code],
  );

  return result.rows[0]?.name ?? code;
}
