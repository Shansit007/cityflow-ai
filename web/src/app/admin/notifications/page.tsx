import Link from "next/link";
import type { Metadata } from "next";

import { CitySwitcher } from "@/components/admin/city-switcher";
import { NotificationComposer } from "@/components/admin/notification-composer";
import { NotificationList, StatTile } from "@/components/admin/panels";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import {
  loadHighPriorityBacklog,
  loadNotificationFeed,
  loadSentNotifications,
} from "@/lib/admin/notifications";
import { formatAppDate } from "@/lib/app-time";
import { getCity } from "@/lib/cities";
import { issueTypeLabel } from "@/lib/roads/types";

export const metadata: Metadata = { title: "Notification center" };

/**
 * Admin Portal — Notification Center.
 *
 * Two real, honestly-sourced things live here — see lib/admin/notifications.ts
 * for why nothing else does:
 *
 *  1. A live feed of road-issue status changes, read from the same audit
 *     trail (RoadIssueEvent) the Municipal Dashboard writes to.
 *  2. A high-priority backlog alert, recomputed on every load against the
 *     city's own configured threshold — never stored, so it cannot go stale.
 */
export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const params = await searchParams;
  const city = getCity(params.city);

  const [feed, backlog, sent] = await Promise.all([
    loadNotificationFeed(city.code),
    loadHighPriorityBacklog(city.code),
    loadSentNotifications(city.code),
  ]);

  const items = feed.items.map((item) => ({
    ...item,
    issueType: issueTypeLabel(item.issueType),
  }));

  return (
    <section className="py-8">
      <Container width="wide">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              Notification center
            </h1>
            <p className="mt-2 text-sm text-muted">
              {city.name} · {formatAppDate()}
            </p>
          </div>

          <CitySwitcher active={city.code} basePath="/admin/notifications" />
        </div>

        {/* -------------------------------------------------------- composer */}
        <div className="mt-8">
          <NotificationComposer cityCode={city.code} />
        </div>

        {/* ---------------------------------------------------- sent notices */}
        <Card className="mt-6">
          <CardHeader
            title="Sent notices"
            description="Every notice an admin has sent to this city, most recent first."
          />

          {sent.length === 0 ? (
            <p className="text-sm text-muted">
              No notices have been sent to {city.name} yet. Use the form above to send one.
            </p>
          ) : (
            <ul className="space-y-3">
              {sent.map((notice) => (
                <li
                  key={notice.id}
                  className="rounded-lg border border-border-base bg-surface-2 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-fg">{notice.title}</p>
                    <span className="text-xs text-subtle">
                      {notice.createdAt.toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{notice.message}</p>
                  <p className="mt-1.5 text-xs text-subtle">Sent by {notice.createdByEmail}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* -------------------------------------------------- backlog alert */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <StatTile
            label="High-priority backlog"
            value={String(backlog.count)}
            detail={`Open road issues at or above priority ${backlog.threshold}/100`}
            tone={backlog.count > 0 ? "alert" : "default"}
          />
          <StatTile
            label="Not yet looked at"
            value={String(backlog.unacknowledged)}
            detail="Of the backlog above, still marked New"
            tone={backlog.unacknowledged > 0 ? "alert" : "default"}
          />
        </div>

        {backlog.count > 0 && (
          <div className="mt-4 rounded-card border border-traffic-high bg-traffic-high-soft p-4">
            <p className="text-sm text-fg">
              {backlog.count} open issue{backlog.count === 1 ? "" : "s"} in {city.name} scored
              at or above this city&apos;s high-priority threshold of {backlog.threshold}/100.
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              The threshold is a per-city setting.{" "}
              <Link href="/admin/config" className="font-medium text-primary hover:underline">
                Adjust it in Configuration
              </Link>{" "}
              or review the issues themselves on the Road conditions page.
            </p>
          </div>
        )}

        {/* --------------------------------------------------------- feed */}
        <Card className="mt-6">
          <CardHeader
            title="Recent activity"
            description="Every status change to a road issue in this city, most recent first."
          />
          <NotificationList items={items} truncated={feed.truncated} />
        </Card>

        {/* ------------------------------------------------- honesty notice */}
        <div className="mt-8 rounded-card border border-border-base bg-surface-2 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="secondary">What is not here</Badge>
          </div>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-muted">
            This feed shows road-issue activity because that is the one workflow in
            CityFlow AI with a real, per-event timestamp already recorded. Things like a
            demand re-optimisation or an aggregation run happen on every request rather than
            as a discrete, timestamped event, so they are reported as a live status on{" "}
            <Link href="/admin/system" className="font-medium text-fg hover:underline">
              System status
            </Link>{" "}
            instead of invented as history here.
          </p>
        </div>
      </Container>
    </section>
  );
}
