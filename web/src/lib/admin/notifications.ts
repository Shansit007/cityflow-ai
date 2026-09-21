import { prisma } from "@/lib/db";
import type { CityCode } from "@/lib/cities";
import { getCityConfig } from "@/lib/city-config";
import type { RoadIssueStatus } from "@prisma/client";

/**
 * Notification Center — a real, timestamped feed for one city, built from two
 * sources that already exist rather than an invented events table:
 *
 *   1. `RoadIssueEvent` — every status change on a road issue, already
 *      recorded with a real `createdAt`. This is the audit trail the
 *      Municipal Dashboard writes to, read back here for admin visibility.
 *   2. A computed high-priority backlog alert — issues at or above the
 *      city's own `highPriorityThreshold` (see city-config.ts) that are not
 *      yet closed. This is recomputed live on every load, not stored, so it
 *      can never go stale.
 *
 * WHAT IS DELIBERATELY NOT HERE
 * Things like "a re-optimisation ran" or "demand aggregation completed" have
 * no per-event timestamp anywhere in the schema today — only a last-run
 * summary. Inventing timestamps for those would misrepresent them as a real
 * history this system does not actually keep. See `loadSystemHealth` in
 * analytics.ts for what IS known about those services.
 */

const FEED_LIMIT = 40;

export type NotificationKind = "STATUS_CHANGE" | "HIGH_PRIORITY_BACKLOG";

export interface StatusChangeNotification {
  kind: "STATUS_CHANGE";
  id: string;
  createdAt: Date;
  fromStatus: string | null;
  toStatus: string;
  areaLabel: string;
  issueType: string;
  note: string | null;
  actor: string | null;
}

export interface NotificationFeed {
  items: StatusChangeNotification[];
  /** True when the city has more matching events than FEED_LIMIT. */
  truncated: boolean;
}

export async function loadNotificationFeed(cityCode: CityCode): Promise<NotificationFeed> {
  const where = { roadIssue: { cityCode } };

  const [rows, totalCount] = await Promise.all([
    prisma.roadIssueEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: FEED_LIMIT,
      select: {
        id: true,
        createdAt: true,
        fromStatus: true,
        toStatus: true,
        note: true,
        roadIssue: { select: { areaLabel: true, issueType: true } },
        employee: { select: { name: true, staffCode: true } },
      },
    }),
    prisma.roadIssueEvent.count({ where }),
  ]);

  return {
    items: rows.map((row) => ({
      kind: "STATUS_CHANGE" as const,
      id: row.id,
      createdAt: row.createdAt,
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      areaLabel: row.roadIssue.areaLabel,
      issueType: row.roadIssue.issueType,
      note: row.note,
      actor: row.employee ? `${row.employee.name} (${row.employee.staffCode})` : null,
    })),
    truncated: totalCount > FEED_LIMIT,
  };
}

export interface HighPriorityBacklog {
  threshold: number;
  /** Not yet CLOSED or REJECTED, and at or above the threshold. */
  count: number;
  /** Of those, how many have not even been looked at (still NEW). */
  unacknowledged: number;
}

const OPEN_STATUSES: RoadIssueStatus[] = [
  "NEW",
  "VERIFIED",
  "ASSIGNED",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "COMPLETED",
];

export interface SentNotification {
  id: string;
  title: string;
  message: string;
  createdByEmail: string;
  createdAt: Date;
}

const SENT_LIMIT = 30;

/** Every admin-authored notice sent to this city, most recent first. */
export async function loadSentNotifications(cityCode: CityCode): Promise<SentNotification[]> {
  return prisma.adminNotification.findMany({
    where: { cityCode },
    orderBy: { createdAt: "desc" },
    take: SENT_LIMIT,
    select: {
      id: true,
      title: true,
      message: true,
      createdByEmail: true,
      createdAt: true,
    },
  });
}

/**
 * Records and "sends" a notice.
 *
 * See the `AdminNotification` model comment for why this is labelled demo
 * delivery: the title and message really are stored, and really do appear in
 * the feed below, but CityFlow AI has no push/SMS/email sender wired up, so
 * nothing is actually delivered to a commuter's phone. Claiming otherwise
 * would be exactly the kind of invented behaviour this project refuses.
 */
export async function sendAdminNotification(input: {
  cityCode: CityCode;
  title: string;
  message: string;
  createdByEmail: string;
}): Promise<SentNotification> {
  return prisma.adminNotification.create({
    data: {
      cityCode: input.cityCode,
      title: input.title,
      message: input.message,
      createdByEmail: input.createdByEmail,
    },
    select: {
      id: true,
      title: true,
      message: true,
      createdByEmail: true,
      createdAt: true,
    },
  });
}

export async function loadHighPriorityBacklog(cityCode: CityCode): Promise<HighPriorityBacklog> {
  const config = await getCityConfig(cityCode);

  const where = {
    cityCode,
    priorityScore: { gte: config.highPriorityThreshold },
    status: { in: OPEN_STATUSES },
  };

  const [count, unacknowledged] = await Promise.all([
    prisma.roadIssue.count({ where }),
    prisma.roadIssue.count({ where: { ...where, status: "NEW" } }),
  ]);

  return { threshold: config.highPriorityThreshold, count, unacknowledged };
}
