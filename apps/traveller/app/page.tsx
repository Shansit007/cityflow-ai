import { AppShell } from "@cityflow/ui";
import { createEngineClient, EngineUnavailableError } from "@cityflow/api-client";

import type { EngineHealth } from "@cityflow/api-client";

export const dynamic = "force-dynamic";

async function readEngineHealth(): Promise<EngineHealth | null> {
  const baseUrl = process.env.ENGINE_URL;
  if (!baseUrl) return null;

  try {
    return await createEngineClient(baseUrl).health();
  } catch (error) {
    if (error instanceof EngineUnavailableError) return null;
    throw error;
  }
}

export default async function HomePage() {
  const health = await readEngineHealth();

  return (
    <AppShell productName="CityFlow AI">
      <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
        Congestion is an arrival-rate problem, not a routing problem.
      </h1>

      <div className="mt-6 max-w-2xl space-y-4 text-[var(--ink-muted)]">
        <p>
          A road segment jams when more vehicles enter it in a quarter of an hour than it
          can absorb. Routing tools move traffic around a jam that already exists.
          CityFlow AI works one step earlier, by spreading departure times so the inflow
          stays under capacity in the first place.
        </p>
        <p>
          Recommendations are advisory. Nothing here restricts when anyone may travel.
        </p>
      </div>

      <EngineStatus health={health} />
    </AppShell>
  );
}

function EngineStatus({ health }: { health: EngineHealth | null }) {
  const label = !health
    ? "not reachable"
    : health.database === "up"
      ? `${health.status} · v${health.version}`
      : `${health.status} · database down`;

  return (
    <dl className="mt-10 flex items-baseline gap-3 border-t border-[var(--line)] pt-4 text-sm">
      <dt className="text-[var(--ink-muted)]">Engine</dt>
      <dd className="font-medium">{label}</dd>
    </dl>
  );
}
