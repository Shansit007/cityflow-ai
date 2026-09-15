import { pool } from "./db";
import type { StaffSession } from "./session";

export const DEFECT_STATUSES = [
  "reported",
  "triaged",
  "assigned",
  "in_progress",
  "resolved",
  "rejected",
] as const;

export type DefectStatus = (typeof DEFECT_STATUSES)[number];

export interface DefectRow {
  id: string;
  severity: string;
  status: DefectStatus;
  confirmations: number;
  first_seen_at: Date;
  lat: number;
  lon: number;
  assignee: string | null;
}

export interface QueueMetrics {
  open: number;
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
       count(*) FILTER (WHERE status NOT IN ('resolved', 'rejected'))::int AS open,
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
  const conditions = ["d.city = $1", "d.severity >= $2"];
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
