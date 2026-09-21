import Link from "next/link";
import type { Metadata } from "next";

import { CitySwitcher } from "@/components/admin/city-switcher";
import { FreshnessPanel, SystemHealthPanel } from "@/components/admin/panels";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { loadCityOverview, loadSystemHealth } from "@/lib/admin/analytics";
import { formatAppDate } from "@/lib/app-time";
import { getCity } from "@/lib/cities";
import { getCityConfig } from "@/lib/city-config";

export const metadata: Metadata = { title: "System status" };

/**
 * Admin Portal — System Status.
 *
 * A single, consolidated place for "is CityFlow AI actually working right
 * now" — the live database check and per-service status already computed by
 * `loadSystemHealth` (see analytics.ts for exactly what each service checks
 * and why some are honestly reported as idle or not connected), plus data
 * freshness and the city's own configured thresholds. Nothing here is a new
 * measurement; it consolidates what the rest of the portal already knows.
 */
export default async function AdminSystemPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const params = await searchParams;
  const city = getCity(params.city);

  const [health, overview, config] = await Promise.all([
    loadSystemHealth(city.code),
    loadCityOverview(city.code),
    getCityConfig(city.code),
  ]);

  return (
    <section className="py-8">
      <Container width="wide">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              System status
            </h1>
            <p className="mt-2 text-sm text-muted">
              {city.name} · {formatAppDate()}
            </p>
          </div>

          <CitySwitcher active={city.code} basePath="/admin/system" />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <SystemHealthPanel health={health} />
          <FreshnessPanel freshness={overview.freshness} />
        </div>

        <Card className="mt-6">
          <CardHeader
            title="Configured thresholds"
            description={`${city.name}'s own tunable values. ${
              config.isConfigured
                ? "Set explicitly for this city."
                : "Not yet set for this city — showing the product defaults."
            }`}
            action={
              <Link
                href="/admin/config"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-border-strong bg-surface px-3.5 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
              >
                Edit
              </Link>
            }
          />

          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted">High-priority threshold</dt>
              <dd className="mt-0.5 font-semibold text-fg">{config.highPriorityThreshold}/100</dd>
            </div>
            <div>
              <dt className="text-muted">Confirmation report count</dt>
              <dd className="mt-0.5 font-semibold text-fg">{config.confirmationReportCount}</dd>
            </div>
            <div>
              <dt className="text-muted">Sensor impact threshold</dt>
              <dd className="mt-0.5 font-semibold text-fg">{config.sensorImpactThreshold} m/s²</dd>
            </div>
            <div>
              <dt className="text-muted">Default flexibility</dt>
              <dd className="mt-0.5 font-semibold text-fg">
                {config.defaultFlexibilityMinutes} min
              </dd>
            </div>
            <div>
              <dt className="text-muted">Peak demand threshold</dt>
              <dd className="mt-0.5 font-semibold text-fg">{config.peakDemandThreshold}/100</dd>
            </div>
          </dl>
        </Card>

        {/* ------------------------------------------------- honesty notice */}
        <div className="mt-8 rounded-card border border-border-base bg-surface-2 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="secondary">Reading this page</Badge>
          </div>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-muted">
            &ldquo;Idle&rdquo; means a service has nothing to do right now, not that it is
            broken — for example, re-optimisation only runs when there is something to
            adjust. &ldquo;Not connected&rdquo; is reported for anything genuinely not wired
            up yet, such as email or push delivery for notifications, rather than hidden.
          </p>
        </div>
      </Container>
    </section>
  );
}
