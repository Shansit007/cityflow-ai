"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProposalCard as Proposal } from "@/lib/chat/assistant";
import { formatTime } from "@/lib/demand/time-slots";
import { demandBadgeTone } from "@/lib/demand/ui";
import { getTransportMode } from "@/lib/travel";

/**
 * The confirmation card.
 *
 * This is where a sentence becomes data, and it is deliberately explicit: it
 * shows the STRUCTURED values that would be saved, not a restatement of what
 * the person typed. If the parser misread "6" as 6 AM, the card says 6:00 AM
 * and the person can see it is wrong before anything is written.
 *
 * Nothing is saved until Confirm is pressed.
 */

interface ProposalCardProps {
  proposal: Proposal;
  /** True while this card is still awaiting a decision. */
  pending: boolean;
  saving: boolean;
  onConfirm: (proposal: Proposal) => void;
  onDismiss: () => void;
  /** Set once the person has acted, so the card can show the outcome. */
  outcome?: string | null;
}

export function ProposalCardView({
  proposal,
  pending,
  saving,
  onConfirm,
  onDismiss,
  outcome,
}: ProposalCardProps) {
  const mode = proposal.transportMode ? getTransportMode(proposal.transportMode) : null;

  return (
    <div className="mt-2 rounded-lg border border-border-strong bg-surface p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-subtle">
        {proposal.cancel ? "Remove today's trip" : "Proposed change"}
      </p>

      <dl className="mt-2.5 space-y-1.5 text-xs">
        {proposal.cancel && (
          <Row label="Travelling today" value="No" />
        )}

        {proposal.updatedDeparture && (
          <Row label="Departure" value={formatTime(proposal.updatedDeparture)} strong />
        )}

        {mode && <Row label="Transport" value={mode.label} strong />}

        {proposal.demandLabel && proposal.demandLevel && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">Predicted demand</dt>
            <dd>
              <Badge tone={demandBadgeTone(proposal.demandLevel)}>
                {proposal.demandLabel}
              </Badge>
            </dd>
          </div>
        )}

        {proposal.estimatedArrival && (
          <Row
            label="Estimated arrival"
            value={formatTime(proposal.estimatedArrival)}
            tone={proposal.arrivesInTime === false ? "danger" : undefined}
          />
        )}
      </dl>

      {proposal.arrivesInTime === false && (
        <p className="mt-2.5 rounded-md bg-traffic-high-soft px-2.5 py-2 text-xs leading-relaxed text-traffic-high">
          This is predicted to arrive after your required arrival time. You can still save it
          — CityFlow AI does not stop you, it just wants you to know.
        </p>
      )}

      {/* ---------------------------------------------------------- actions */}
      {pending ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onConfirm(proposal)} loading={saving}>
            Confirm
          </Button>

          {proposal.quieterAlternative && proposal.updatedDeparture && (
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() =>
                onConfirm({
                  ...proposal,
                  updatedDeparture: proposal.quieterAlternative!.time,
                })
              }
            >
              Use {formatTime(proposal.quieterAlternative.time)} instead
            </Button>
          )}

          <Button size="sm" variant="ghost" onClick={onDismiss} disabled={saving}>
            Not now
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-xs font-medium text-muted">{outcome ?? "No change saved."}</p>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  strong = false,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "danger";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd
        className={
          tone === "danger"
            ? "font-semibold text-traffic-high"
            : strong
              ? "font-semibold text-fg"
              : "text-fg"
        }
      >
        {value}
      </dd>
    </div>
  );
}
