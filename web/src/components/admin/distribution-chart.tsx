import { Card, CardHeader } from "@/components/ui/card";
import type { DistributionBucket } from "@/lib/admin/demand-shift";
import { cn } from "@/lib/utils";

/**
 * Original vs current departure-time distribution.
 *
 * FORM: two magnitudes over the same time axis → paired bars, one pair per
 * hour, same convention `DayCurve` already uses for a single series.
 *
 * COLOUR: two series, so two colours, named in a legend — never colour alone,
 * per the same rule every other chart in this portal follows.
 */
export function DistributionChart({
  distribution,
  sampleSize,
  windowDays,
}: {
  distribution: DistributionBucket[];
  sampleSize: number;
  windowDays: number;
}) {
  if (sampleSize === 0) {
    return (
      <Card>
        <CardHeader
          title="Original vs current departure-time distribution"
          description={`No recommendation has been decided in the last ${windowDays} days yet.`}
        />
        <p className="text-sm text-muted">
          This chart needs at least one accepted, kept-usual or custom-time decision to
          compare a before and an after. It will fill in as people respond.
        </p>
      </Card>
    );
  }

  const maxPercent = Math.max(1, ...distribution.map((b) => Math.max(b.originalPercent, b.currentPercent)));

  // The single biggest swing, named in words — the PDF's own example ("6:00PM
  // 70% -> 45%") is exactly this sentence with real numbers in it.
  const biggestSwing = [...distribution].sort(
    (a, b) => Math.abs(b.currentPercent - b.originalPercent) - Math.abs(a.currentPercent - a.originalPercent)
  )[0];

  return (
    <Card>
      <CardHeader
        title="Original vs current departure-time distribution"
        description={`${sampleSize} decided recommendation${sampleSize === 1 ? "" : "s"} in the last ${windowDays} days, by the hour they leave in.`}
      />

      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-4 rounded-sm bg-border-strong" aria-hidden="true" />
          Original (usual time)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-4 rounded-sm bg-primary" aria-hidden="true" />
          Current (what they settled on)
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[52rem]">
          <div className="flex h-40 items-end gap-1" aria-hidden="true">
            {distribution.map((bucket) => (
              <div key={bucket.hour} className="flex h-full flex-1 items-end gap-[2px]">
                <div
                  title={`${bucket.label} original — ${bucket.originalPercent}%`}
                  className="flex-1 rounded-t-sm bg-border-strong"
                  style={{ height: `${Math.max(2, (bucket.originalPercent / maxPercent) * 100)}%` }}
                />
                <div
                  title={`${bucket.label} current — ${bucket.currentPercent}%`}
                  className={cn(
                    "flex-1 rounded-t-sm",
                    bucket.currentPercent > bucket.originalPercent ? "bg-primary" : "bg-primary/70"
                  )}
                  style={{ height: `${Math.max(2, (bucket.currentPercent / maxPercent) * 100)}%` }}
                />
              </div>
            ))}
          </div>

          <div className="mt-2 flex gap-1" aria-hidden="true">
            {distribution.map((bucket) => (
              <div key={bucket.hour} className="flex-1 text-center">
                {bucket.hour % 2 === 0 && (
                  <span className="text-[0.6rem] text-subtle">{bucket.label}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {biggestSwing && biggestSwing.originalPercent !== biggestSwing.currentPercent && (
        <p className="mt-5 border-t border-border-base pt-4 text-sm text-muted">
          The largest swing: <span className="font-semibold text-fg">{biggestSwing.label}</span>{" "}
          moved from <span className="font-medium text-fg">{biggestSwing.originalPercent}%</span>{" "}
          of decided trips to <span className="font-medium text-fg">{biggestSwing.currentPercent}%</span>.
        </p>
      )}

      <p className="sr-only-cf">
        Original versus current departure distribution by hour:{" "}
        {distribution
          .filter((b) => b.originalCount > 0 || b.currentCount > 0)
          .map((b) => `${b.label} original ${b.originalPercent}%, current ${b.currentPercent}%`)
          .join(", ")}
        .
      </p>
    </Card>
  );
}
