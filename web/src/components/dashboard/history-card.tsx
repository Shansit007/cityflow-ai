import type { ReactNode } from "react";

import Link from "next/link";

import type { Recommendation } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { APP_TIMEZONE } from "@/lib/app-time";
import { formatTime } from "@/lib/demand/time-slots";

/**
 * Recommendation history.
 *
 * Shows what was suggested, what the person actually chose, and the predicted
 * demand at the time. It deliberately does NOT claim an outcome ("you saved 12
 * minutes"), because CityFlow AI has no way to measure the journey that
 * actually happened. Claiming one would be the easiest and worst lie the
 * product could tell.
 */

interface HistoryCardProps {
  recommendations: Recommendation[];
}

export function HistoryCard({ recommendations }: HistoryCardProps) {
  if (recommendations.length === 0) {
    return (
      <Card>
        <CardHeader title="Recommendation history" />
        <div className="rounded-lg border border-dashed border-border-strong bg-surface-2 p-5 text-center">
          <p className="text-sm text-muted">
            Nothing here yet. Once you have used CityFlow AI for a few days, your
            recommendations and the times you chose will be listed here.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Recommendation history"
        description="What was suggested, and what you decided."
      />

      {/* Horizontal scroll rather than a squashed table on small screens. */}
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <caption className="sr-only-cf">
            Your recent departure recommendations and decisions
          </caption>
          <thead>
            <tr className="border-b border-border-base text-left">
              <Th>Date</Th>
              <Th>Recommended</Th>
              <Th>Your choice</Th>
              <Th>Demand then</Th>
            </tr>
          </thead>

          <tbody>
            {recommendations.map((item) => (
              <tr key={item.id} className="border-b border-border-base last:border-0">
                <Td>{formatDate(item.travelDate)}</Td>
                <Td className="font-medium text-fg">
                  {formatTime(item.recommendedDeparture)}
                </Td>
                <Td>
                  {item.status === "PENDING" ? (
                    <Badge tone="neutral">No decision</Badge>
                  ) : (
                    <span className="font-medium text-fg">
                      {formatTime(item.chosenDeparture ?? item.usualDeparture)}
                    </span>
                  )}
                </Td>
                <Td>
                  <span className="text-muted">
                    {item.demandAtUsual} → {item.demandAtRecommended}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-subtle">
        "Demand then": index at usual vs. recommended time ·{" "}
        <Link href="/how-it-works#how-numbers-work" className="underline underline-offset-2">
          how this works
        </Link>
      </p>
    </Card>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th scope="col" className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-subtle">
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={`px-1 py-3 align-middle ${className}`}>{children}</td>;
}

/** "Tue, 9 Sep" in the application timezone. */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}
