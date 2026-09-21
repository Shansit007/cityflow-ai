import type { Metadata } from "next";

import { CitySwitcher } from "@/components/admin/city-switcher";
import { BreakdownBarPanel, StatTile } from "@/components/admin/panels";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { loadIntentIntelligence } from "@/lib/admin/intent-intelligence";
import { formatAppDate } from "@/lib/app-time";
import { getCity } from "@/lib/cities";

export const metadata: Metadata = { title: "Travel-intent intelligence" };

/**
 * Admin Portal — AI Travel-Intent Intelligence.
 *
 * A "travel intention" is created whenever Saarthi (chat) or the dashboard
 * changes someone's departure time, mode, or cancels a trip. This page reports
 * on that in aggregate over the last 30 days — how much people are actually
 * changing their plans, in which direction, and whether the chat assistant or
 * the dashboard is driving it. See lib/admin/intent-intelligence.ts for the
 * privacy rule: no chat text, user id or journey label is ever selected.
 */
export default async function AdminIntentPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const params = await searchParams;
  const city = getCity(params.city);

  const intel = await loadIntentIntelligence(city.code);

  return (
    <section className="py-8">
      <Container width="wide">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              Travel-intent intelligence
            </h1>
            <p className="mt-2 text-sm text-muted">
              {city.name} · {formatAppDate()} · last {intel.windowDays} days
            </p>
          </div>

          <CitySwitcher active={city.code} basePath="/admin/intent" />
        </div>

        {/* ------------------------------------------------------- top tiles */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Plan changes"
            value={String(intel.totalIntentions)}
            detail={`In the last ${intel.windowDays} days`}
          />
          <StatTile
            label="Departure time actually shifted"
            value={String(intel.departureShift.changedCount)}
            detail={
              intel.departureShift.avgAbsoluteMinutes === null
                ? "No shifts recorded yet"
                : `Average shift: ${intel.departureShift.avgAbsoluteMinutes} min`
            }
          />
          <StatTile
            label="Moved earlier vs later"
            value={`${intel.departureShift.movedEarlier} / ${intel.departureShift.movedLater}`}
            detail="Earlier departures vs later departures"
          />
          <StatTile
            label="Mode changed from usual"
            value={
              intel.modeChange.changeRate === null ? "—" : `${intel.modeChange.changeRate}%`
            }
            detail={
              intel.modeChange.comparable > 0
                ? `${intel.modeChange.changed} of ${intel.modeChange.comparable} comparable plans`
                : "No plans linked to a saved routine yet"
            }
          />
        </div>

        {/* --------------------------------------------------------- panels */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <BreakdownBarPanel
            title="Where the change came from"
            description="Whether the plan change was made in chat with Saarthi or directly on the dashboard."
            rows={[
              { label: "Saarthi (chat)", value: intel.source.chat },
              { label: "Dashboard", value: intel.source.dashboard, tone: "secondary" },
            ]}
            emptyMessage="No plan changes recorded in this window yet."
          />

          <BreakdownBarPanel
            title="What happened to the plan"
            description="Confirmed and counted in demand, cancelled, or replaced by a later change."
            rows={[
              { label: "Confirmed", value: intel.status.confirmed },
              { label: "Cancelled", value: intel.status.cancelled, tone: "secondary" },
              { label: "Superseded", value: intel.status.superseded, tone: "secondary" },
            ]}
            emptyMessage="No plan changes recorded in this window yet."
          />
        </div>

        <Card className="mt-6">
          <CardHeader
            title="Reading these figures"
            description="What a travel intention is, and what it is not."
          />
          <p className="text-sm leading-relaxed text-muted">
            A travel intention is created whenever someone changes their departure time,
            switches transport mode, or cancels a trip for a specific date — through Saarthi
            or the dashboard. &ldquo;Mode changed from usual&rdquo; only counts plans linked
            to a saved routine, since that is the only place a person&apos;s usual mode is
            recorded to compare against.
            {intel.sampled && (
              <>
                {" "}
                The shift and mode figures above are based on a sample of recent plan
                changes rather than every one in the window, because there were more than
                this page scans in a single load.
              </>
            )}
          </p>
        </Card>

        {/* ------------------------------------------------- privacy notice */}
        <div className="mt-8 rounded-card border border-border-base bg-surface-2 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="secondary">Privacy</Badge>
          </div>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-muted">
            Nothing on this page is text from a conversation. The queries behind it read
            only the departure times, transport mode, source and status already stored on
            each travel intention — never the chat messages that led to it, and never who
            made the change.
          </p>
        </div>
      </Container>
    </section>
  );
}
