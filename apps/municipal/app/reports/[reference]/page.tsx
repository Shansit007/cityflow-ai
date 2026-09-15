import Link from "next/link";
import { notFound } from "next/navigation";

import { AssignControl } from "@/components/assign-control";
import { ConfirmationBadge, PriorityBadge } from "@/components/badges";
import { DefectActions } from "@/components/defect-actions";
import { Panel } from "@/components/panel";
import { Shell } from "@/components/shell";
import { confirmationOf, priorityOf } from "@/lib/classify";
import { defectByReference, employees, teams } from "@/lib/defects";
import { staffContext } from "@/lib/context";
import { STATUS_LABELS } from "@/lib/transitions";

export const dynamic = "force-dynamic";

function when(value: Date): string {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function DefectDetailPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { session, threshold, cityName } = await staffContext();
  const { reference } = await params;

  const defect = await defectByReference(session, decodeURIComponent(reference));
  if (!defect) notFound();

  const [crew, crews] = await Promise.all([
    session.role === "head" ? employees(session.city) : Promise.resolve([]),
    session.role === "head" ? teams(session.city) : Promise.resolve([]),
  ]);

  const confirmation = confirmationOf(defect.confirmations, threshold);
  const priority = priorityOf(defect.confirmations, threshold);

  return (
    <Shell
      session={session}
      threshold={threshold}
      cityName={cityName}
      title={defect.reference}
      subtitle={`${defect.ward ? `Ward ${defect.ward} · ` : ""}Municipal inspection
        record for ${cityName}.`}
    >
      <Link
        href="/reports"
        className="text-sm font-semibold text-[var(--navy)] hover:underline dark:text-[var(--accent)]"
      >
        &larr; Back to reports
      </Link>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Validation"
          subtitle="Why this is treated as a defect rather than one person's bad road."
        >
          <dl className="grid grid-cols-2 gap-4">
            <Fact
              label="Independent confirmations"
              value={String(defect.confirmations)}
            />
            <Fact label="Confirmation threshold" value={String(threshold)} />
            <Fact
              label="Detector severity"
              value={Number(defect.severity).toFixed(2)}
              note="Mean jolt magnitude, 0 to 1"
            />
            <Fact label="Stage" value={STATUS_LABELS[defect.status]} />
          </dl>

          <p className="mt-4 flex flex-wrap gap-2">
            <ConfirmationBadge value={confirmation} />
            <PriorityBadge value={priority} />
          </p>

          <p className="mt-4 text-xs text-[var(--ink-muted)]">
            {confirmation === "Confirmed"
              ? `${defect.confirmations} separate travellers registered this place, at or
                 above the ${threshold} the head of road maintenance requires.`
              : `${defect.confirmations} separate travellers have registered this place.
                 It becomes Confirmed at ${threshold}.`}
          </p>
        </Panel>

        <div className="grid gap-4">
          <Panel title="Location">
            <dl className="grid gap-3">
              <Fact
                label="Coordinates"
                value={`${defect.lat.toFixed(5)}, ${defect.lon.toFixed(5)}`}
              />
              <Fact label="Ward" value={defect.ward ? String(defect.ward) : "Unknown"} />
              <Fact label="First detected" value={when(defect.first_seen_at)} />
              <Fact label="Last detected" value={when(defect.last_seen_at)} />
            </dl>
          </Panel>

          <Panel title="Field work">
            {session.role === "head" ? (
              <AssignControl
                defectId={defect.id}
                assignedTo={defect.assigned_to}
                assignedTeam={defect.assigned_team}
                employees={crew}
                teams={crews}
                label="Employee or field team"
              />
            ) : (
              <p className="text-sm">
                Assigned to <strong>{defect.assignee ?? "nobody yet"}</strong>
              </p>
            )}

            <div className="mt-4">
              <DefectActions
                defectId={defect.id}
                status={defect.status}
                role={session.role}
              />
            </div>

            {defect.resolution_note ? (
              <p className="mt-4 border-t border-[var(--line)] pt-3 text-sm">
                <span className="block text-xs font-semibold text-[var(--ink-muted)]">
                  Resolution
                </span>
                {defect.resolution_note}
              </p>
            ) : null}
          </Panel>
        </div>
      </div>
    </Shell>
  );
}

function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-[var(--ink-muted)]">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
      {note ? <p className="text-[11px] text-[var(--ink-faint)]">{note}</p> : null}
    </div>
  );
}
