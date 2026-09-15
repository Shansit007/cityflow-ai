import { pool } from "./db";
import type { StaffSession } from "./session";
import { statusesLeadingTo, TransitionRefused, type DefectStatus } from "./transitions";

export interface DefectRow {
  id: string;
  severity: string;
  status: DefectStatus;
  confirmations: number;
  first_seen_at: Date;
  lat: number;
  lon: number;
  assignee: string | null;
  assigned_to: string | null;
}

export interface QueueMetrics {
  open_count: number;
  unassigned: number;
  this_month: number;
  median_resolve_seconds: number | null;
}

const DEFAULT_PRIORITY_THRESHOLD = 0.6;

export async function priorityThreshold(city: string): Promise<number> {
  const result = await pool().query<{ priority_threshold: string }>(
    `SELECT priority_threshold FROM municipal_settings WHERE city = $1`,
    [city],
  );

  const row = result.rows[0];
  return row ? Number(row.priority_threshold) : DEFAULT_PRIORITY_THRESHOLD;
}

/**
 * The four numbers on the strip, in one round trip.
 *
 * Time to resolve is the median rather than the mean because a queue always contains a
 * few defects that sat for months, and a mean that they drag upwards describes nothing
 * anybody experiences.
 */
export async function queueMetrics(city: string): Promise<QueueMetrics> {
  const result = await pool().query<QueueMetrics>(
    `SELECT
       count(*) FILTER (WHERE status NOT IN ('resolved', 'rejected'))::int
         AS open_count,
       count(*) FILTER (
         WHERE status IN ('reported', 'triaged') AND assigned_to IS NULL
       )::int AS unassigned,
       count(*) FILTER (
         WHERE first_seen_at >= date_trunc('month', now())
       )::int AS this_month,
       percentile_cont(0.5) WITHIN GROUP (
         ORDER BY extract(epoch FROM (resolved_at - first_seen_at))
       ) FILTER (WHERE resolved_at IS NOT NULL) AS median_resolve_seconds
     FROM defect_reports
     WHERE city = $1`,
    [city],
  );

  return result.rows[0]!;
}

export interface QueueFilter {
  status?: DefectStatus;
  minSeverity: number;
}

export async function queue(
  session: StaffSession,
  filter: QueueFilter,
): Promise<DefectRow[]> {
  const conditions = ["d.city = $1", "d.severity >= $2::numeric"];
  const values: unknown[] = [session.city, filter.minSeverity];

  if (filter.status) {
    values.push(filter.status);
    conditions.push(`d.status = $${values.length}`);
  }

  // An employee sees the work assigned to them and nothing else. Enforced in the query
  // rather than by hiding rows in the page, so a crafted request cannot widen it.
  if (session.role === "employee") {
    values.push(session.userId);
    conditions.push(`d.assigned_to = $${values.length}`);
  }

  const result = await pool().query<DefectRow>(
    `SELECT d.id, d.severity, d.status, d.confirmations, d.first_seen_at,
            ST_Y(d.location::geometry) AS lat,
            ST_X(d.location::geometry) AS lon,
            d.assigned_to,
            u.display_name AS assignee
       FROM defect_reports d
       LEFT JOIN municipal_users u ON u.id = d.assigned_to
      WHERE ${conditions.join(" AND ")}
      ORDER BY d.severity DESC, d.first_seen_at
      LIMIT 200`,
    values,
  );

  return result.rows;
}

export interface Employee {
  id: string;
  display_name: string;
}

export async function employees(city: string): Promise<Employee[]> {
  const result = await pool().query<Employee>(
    `SELECT id, display_name
       FROM municipal_users
      WHERE city = $1 AND role = 'employee' AND active
      ORDER BY display_name`,
    [city],
  );

  return result.rows;
}

export async function setStatus(
  session: StaffSession,
  id: string,
  to: DefectStatus,
  note: string | null,
): Promise<void> {
  const from = statusesLeadingTo(session.role, to);

  if (from.length === 0) {
    throw new TransitionRefused(`A ${session.role} cannot move a defect to ${to}.`);
  }
  if (to === "resolved" && !note?.trim()) {
    throw new TransitionRefused("A resolved defect needs a note saying what was done.");
  }

  const mine = session.role === "employee" ? "AND assigned_to = $5" : "";

  const result = await pool().query(
    `UPDATE defect_reports
        SET status = $1,
            resolution_note = CASE WHEN $1 = 'resolved' THEN $2 ELSE resolution_note END,
            resolved_at = CASE WHEN $1 = 'resolved' THEN now() ELSE resolved_at END,
            resolved_by = CASE WHEN $1 = 'resolved' THEN $5 ELSE resolved_by END
      WHERE id = $3
        AND city = $4
        AND status = ANY($6::defect_status[])
        ${mine}`,
    [to, note?.trim() ?? null, id, session.city, session.userId, from],
  );

  if (result.rowCount === 0) {
    throw new TransitionRefused("That defect has already moved on. Reload the queue.");
  }
}

export async function assign(
  session: StaffSession,
  id: string,
  employeeId: string | null,
): Promise<void> {
  if (session.role !== "head") {
    throw new TransitionRefused("Only the head of road maintenance assigns work.");
  }

  const result = await pool().query(
    `UPDATE defect_reports d
        SET assigned_to = $1,
            status = CASE
              WHEN $1 IS NULL AND d.status = 'assigned' THEN 'triaged'::defect_status
              WHEN $1 IS NOT NULL AND d.status IN ('reported', 'triaged')
                THEN 'assigned'::defect_status
              ELSE d.status
            END
      WHERE d.id = $2
        AND d.city = $3
        AND d.status NOT IN ('resolved', 'rejected')
        AND ($1 IS NULL OR EXISTS (
              SELECT 1 FROM municipal_users u
               WHERE u.id = $1 AND u.city = d.city AND u.role = 'employee' AND u.active
            ))`,
    [employeeId, id, session.city],
  );

  if (result.rowCount === 0) {
    throw new TransitionRefused("That defect cannot be assigned to that person.");
  }
}

export async function setThreshold(
  session: StaffSession,
  threshold: number,
): Promise<void> {
  if (session.role !== "head") {
    throw new TransitionRefused("Only the head of road maintenance sets the threshold.");
  }
  if (!(threshold >= 0 && threshold <= 1)) {
    throw new TransitionRefused("The threshold is a severity between 0 and 1.");
  }

  await pool().query(
    `INSERT INTO municipal_settings (city, priority_threshold, updated_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (city) DO UPDATE
        SET priority_threshold = EXCLUDED.priority_threshold,
            updated_by = EXCLUDED.updated_by,
            updated_at = now()`,
    [session.city, threshold, session.userId],
  );
}
