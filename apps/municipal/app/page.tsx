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

export default async function OverviewPage() {
  const health = await readEngineHealth();

  return (
    <AppShell productName="CityFlow AI" surface="Municipal">
      <h1 className="text-2xl font-semibold tracking-tight">Road defect triage</h1>

      <p className="mt-4 max-w-2xl text-sm text-[var(--ink-muted)]">
        Defect reports reach this dashboard only after several travellers independently
        register the same anomaly at the same place, which is what separates a pothole
        from one badly mounted phone. Staff triage by severity and assign to a crew.
      </p>

      <table className="mt-8 w-full max-w-xl border-collapse text-sm">
        <caption className="pb-2 text-left text-xs uppercase tracking-wide text-[var(--ink-muted)]">
          Service status
        </caption>
        <tbody>
          <StatusRow label="Engine" value={health ? health.status : "not reachable"} />
          <StatusRow label="Database" value={health ? health.database : "unknown"} />
          <StatusRow label="Engine version" value={health ? health.version : "—"} />
        </tbody>
      </table>
    </AppShell>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-[var(--line)]">
      <th scope="row" className="py-2 pr-6 text-left font-normal text-[var(--ink-muted)]">
        {label}
      </th>
      <td className="py-2 font-medium">{value}</td>
    </tr>
  );
}
