import { pool } from "./db";
import { CRITICAL_CONFIRMATIONS, HIGH_CONFIRMATIONS, type Priority } from "./classify";
import type { StaffSession } from "./session";
import { statusesLeadingTo, TransitionRefused, type DefectStatus } from "./transitions";

export interface DefectRow {
  id: string;
  reference: string;
  severity: string;
  confirmations: number;
  status: DefectStatus;
  ward: number | null;
  first_seen_at: Date;
  last_seen_at: Date;
  lat: number;
  lon: number;
  assigned_to: string | null;
  assigned_team: string | null;
  assignee: string | null;
  resolution_note: string | null;
}

export interface QueueMetrics {
  total: number;
  confirmed: number;
  urgent: number;
  awaiting_assignment: number;
  open_count: number;
  median_resolve_seconds: number | null;
}

const DEFAULT_CONFIRMATION_THRESHOLD = 20;
export const MIN_CONFIRMATION_THRESHOLD = 2;

export async function confirmationThreshold(city: string): Promise<number> {
  const result = await pool().query<{ confirmation_threshold: number }>(
    `SELECT confirmation_threshold FROM municipal_settings WHERE city = $1`,
    [city],
  );

  return result.rows[0]?.confirmation_threshold ?? DEFAULT_CONFIRMATION_THRESHOLD;
}

/**
 * The strip across the top, in one round trip.
 *
 * Confirmed and urgent counts depend on the threshold, which is why it is a parameter
 * here rather than a column on the row: raising it re-labels the whole queue without
 * touching a single defect, because it is a statement about how many crews the city
 * has this month and not about any hole in the road.
 *
 * Time to resolve is the median, not the mean. Every queue contains a few defects that
 * sat for months, and a mean they drag upwards describes nobody's experience.
 */
export async function queueMetrics(
  city: string,
  threshold: number,
): Promise<QueueMetrics> {
  const urgent = Math.max(HIGH_CONFIRMATIONS, threshold);

  const result = await pool().query<QueueMetrics>(
    `SELECT
       count(*)::int AS total,
       count(*) FILTER (WHERE confirmations >= $2)::int AS confirmed,
       count(*) FILTER (WHERE confirmations >= $3)::int AS urgent,
       count(*) FILTER (
         WHERE confirmations >= $2
           AND status NOT IN ('resolved', 'rejected')
           AND assigned_to IS NULL
           AND assigned_team IS NULL
       )::int AS awaiting_assignment,
       count(*) FILTER (WHERE status NOT IN ('resolved', 'rejected'))::int AS open_count,
       percentile_cont(0.5) WITHIN GROUP (
         ORDER BY extract(epoch FROM (resolved_at - first_seen_at))
       ) FILTER (WHERE resolved_at IS NOT NULL) AS median_resolve_seconds
     FROM defect_reports
     WHERE city = $1`,
    [city, threshold, urgent],
  );

  return result.rows[0]!;
}

export interface QueueFilter {
  search?: string;
  confirmation?: "Confirmed" | "Under Review";
  priority?: Priority;
  confirmedOnly?: boolean;
  openOnly?: boolean;
  limit?: number;
}

/** The confirmation count range a priority band covers at this threshold. */
function bandFor(priority: Priority, threshold: number): [number, number | null] {
  const critical = Math.max(CRITICAL_CONFIRMATIONS, threshold);
  const high = Math.max(HIGH_CONFIRMATIONS, threshold);

  switch (priority) {
    case "Critical":
      return [critical, null];
    case "High":
      return [high, critical];
    case "Medium":
      return [threshold, high];
    case "Review":
      return [0, threshold];
  }
}

const COLUMNS = `d.id, d.reference, d.severity, d.confirmations, d.status, d.ward,
       d.first_seen_at, d.last_seen_at, d.resolution_note,
       ST_Y(d.location::geometry) AS lat,
       ST_X(d.location::geometry) AS lon,
       d.assigned_to, d.assigned_team,
       coalesce(u.display_name, t.name) AS assignee`;

const JOINS = `LEFT JOIN municipal_users u ON u.id = d.assigned_to
       LEFT JOIN municipal_teams t ON t.id = d.assigned_team`;

export async function queue(
  session: StaffSession,
  threshold: number,
  filter: QueueFilter,
): Promise<DefectRow[]> {
  const conditions = ["d.city = $1"];
  const values: unknown[] = [session.city];

  const add = (clause: (placeholder: string) => string, value: unknown) => {
    values.push(value);
    conditions.push(clause(`$${values.length}`));
  };

  if (filter.search?.trim()) {
    // One box over the two things staff have to hand: a report number read off a work
    // order, or a ward number. Two placeholders because the reference is matched
    // loosely and the ward exactly - ward 4 should not match ward 42.
    const term = filter.search.trim();

    values.push(`%${term}%`);
    const like = `$${values.length}`;
    values.push(term);
    const exact = `$${values.length}`;

    conditions.push(`(d.reference ILIKE ${like} OR d.ward::text = ${exact})`);
  }

  if (filter.confirmation === "Confirmed" || filter.confirmedOnly) {
    add((p) => `d.confirmations >= ${p}`, threshold);
  } else if (filter.confirmation === "Under Review") {
    add((p) => `d.confirmations < ${p}`, threshold);
  }

  if (filter.priority) {
    const [from, to] = bandFor(filter.priority, threshold);
    add((p) => `d.confirmations >= ${p}`, from);
    if (to !== null) add((p) => `d.confirmations < ${p}`, to);
  }

  if (filter.openOnly) {
    conditions.push("d.status NOT IN ('resolved', 'rejected')");
  }

  // An employee sees the work that is theirs, personally or through their crew, and
  // nothing else. Enforced in the query rather than by hiding rows in the page, so a
  // crafted request cannot widen it.
  if (session.role === "employee") {
    values.push(session.userId);
    conditions.push(
      `(d.assigned_to = $${values.length}
        OR d.assigned_team = (SELECT team_id FROM municipal_users
                               WHERE id = $${values.length}))`,
    );
  }

  values.push(filter.limit ?? 200);

  const result = await pool().query<DefectRow>(
    `SELECT ${COLUMNS}
       FROM defect_reports d
       ${JOINS}
      WHERE ${conditions.join(" AND ")}
      ORDER BY d.confirmations DESC, d.first_seen_at
      LIMIT $${values.length}`,
    values,
  );

  return result.rows;
}

export async function defectByReference(
  session: StaffSession,
  reference: string,
): Promise<DefectRow | null> {
  const result = await pool().query<DefectRow>(
    `SELECT ${COLUMNS}
       FROM defect_reports d
       ${JOINS}
      WHERE d.city = $1 AND d.reference = $2`,
    [session.city, reference],
  );

  return result.rows[0] ?? null;
}

export interface Employee {
  id: string;
  display_name: string;
  job_title: string | null;
  team_name: string | null;
}

export async function employees(city: string): Promise<Employee[]> {
  const result = await pool().query<Employee>(
    `SELECT u.id, u.display_name, u.job_title, t.name AS team_name
       FROM municipal_users u
       LEFT JOIN municipal_teams t ON t.id = u.team_id
      WHERE u.city = $1 AND u.role = 'employee' AND u.active
      ORDER BY u.display_name`,
    [city],
  );

  return result.rows;
}

export interface Team {
  id: string;
  name: string;
}

export async function teams(city: string): Promise<Team[]> {
  const result = await pool().query<Team>(
    `SELECT id, name FROM municipal_teams WHERE city = $1 ORDER BY name`,
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

  const mine =
    session.role === "employee"
      ? `AND (assigned_to = $5
             OR assigned_team = (SELECT team_id FROM municipal_users WHERE id = $5))`
      : "";

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

/**
 * Sends a defect to one person, one crew, or nobody.
 *
 * `assignee` is "user:<id>", "team:<id>", or null. One field carries both because the
 * schema allows only one of them to be set, and a caller that could pass both would
 * eventually pass both.
 */
export async function assign(
  session: StaffSession,
  id: string,
  assignee: string | null,
): Promise<void> {
  if (session.role !== "head") {
    throw new TransitionRefused("Only the head of road maintenance assigns work.");
  }

  const [kind, target] = assignee ? assignee.split(":") : [null, null];
  if (assignee && kind !== "user" && kind !== "team") {
    throw new TransitionRefused("Assign to a person or a crew.");
  }

  const userId = kind === "user" ? target : null;
  const teamId = kind === "team" ? target : null;

  // Both targets are cast explicitly. Unassigning sends null for each, and a null
  // parameter whose only other use is inside a CASE gives Postgres nothing to infer a
  // type from; that fails when the statement is planned rather than as a constraint
  // violation, so it surfaces as a fault and not as a refusal.
  const result = await pool().query(
    `UPDATE defect_reports
        SET assigned_to = $1::uuid,
            assigned_team = $2::uuid,
            status = CASE
              WHEN $1::uuid IS NULL AND $2::uuid IS NULL AND status = 'assigned'
                THEN 'triaged'::defect_status
              WHEN ($1::uuid IS NOT NULL OR $2::uuid IS NOT NULL)
                AND status IN ('reported', 'triaged')
                THEN 'assigned'::defect_status
              ELSE status
            END
      WHERE id = $3::uuid
        AND city = $4
        AND status NOT IN ('resolved', 'rejected')
        AND ($1::uuid IS NULL OR EXISTS (
              SELECT 1 FROM municipal_users u
               WHERE u.id = $1::uuid
                 AND u.city = defect_reports.city
                 AND u.role = 'employee'
                 AND u.active
            ))
        AND ($2::uuid IS NULL OR EXISTS (
              SELECT 1 FROM municipal_teams t
               WHERE t.id = $2::uuid AND t.city = defect_reports.city
            ))`,
    [userId, teamId, id, session.city],
  );

  if (result.rowCount === 0) {
    throw new TransitionRefused("That defect cannot be assigned to that recipient.");
  }
}

export async function setThreshold(
  session: StaffSession,
  threshold: number,
): Promise<void> {
  if (session.role !== "head") {
    throw new TransitionRefused("Only the head of road maintenance sets the threshold.");
  }
  if (!Number.isInteger(threshold) || threshold < MIN_CONFIRMATION_THRESHOLD) {
    throw new TransitionRefused(
      `A threshold is a whole number of confirmations, at least ${MIN_CONFIRMATION_THRESHOLD}.`,
    );
  }

  await pool().query(
    `INSERT INTO municipal_settings (city, confirmation_threshold, updated_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (city) DO UPDATE
        SET confirmation_threshold = EXCLUDED.confirmation_threshold,
            updated_by = EXCLUDED.updated_by,
            updated_at = now()`,
    [session.city, threshold, session.userId],
  );
}
