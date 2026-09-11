import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import type { RoadIssueView } from "@/lib/roads/road-service";
import { confidenceMeta, issueTypeLabel, severityLabel } from "@/lib/roads/types";

/**
 * The list of possible road issues near a person.
 *
 * THE RULE THIS COMPONENT FOLLOWS
 * Every item states how much evidence there is, in words, next to the label —
 * never a colour on its own. A person reading this needs to be able to tell the
 * difference between "one person mentioned this once" and "eleven people
 * independently reported it", because those justify very different behaviour on
 * the road.
 */

interface IssueListProps {
  issues: RoadIssueView[];
  /** Shown when there is nothing to list. */
  emptyArea: string;
}

export function RoadIssueList({ issues, emptyArea }: IssueListProps) {
  if (issues.length === 0) {
    return (
      <Card>
        <CardHeader title="Possible road issues near you" />
        <div className="rounded-lg border border-dashed border-border-strong bg-surface-2 p-6 text-center">
          <p className="text-sm font-medium text-fg">
            Nothing has been reported around {emptyArea} yet
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            That does not mean the roads are fine — it means nobody using CityFlow AI has
            reported anything here. If you know of a problem, the form below is the fastest way
            to put it in front of the municipal team.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Possible road issues near you"
        description={`${issues.length} place${issues.length === 1 ? "" : "s"} reported in the areas you travel between.`}
      />

      <ul className="space-y-3">
        {issues.map((issue) => (
          <IssueRow key={issue.id} issue={issue} />
        ))}
      </ul>

      <p className="mt-5 text-xs leading-relaxed text-subtle">
        None of these has been inspected. CityFlow AI collects and prioritises reports; the
        municipal road-maintenance team inspects and repairs, in their own separate system.
      </p>
    </Card>
  );
}

function IssueRow({ issue }: { issue: RoadIssueView }) {
  const meta = confidenceMeta(issue.confidence);

  return (
    <li className="rounded-lg border border-border-base bg-surface-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg">
            {issueTypeLabel(issue.issueType)}
            <span className="mx-2 text-border-strong" aria-hidden="true">
              ·
            </span>
            <span className="font-normal text-muted">{issue.areaLabel}</span>
          </p>

          <p className="mt-1 text-xs text-muted">
            Reported as <span className="font-medium text-fg">{severityLabel(issue.severity)}</span>
            {" · "}
            {issue.reportCount} independent report{issue.reportCount === 1 ? "" : "s"}
            {issue.sensorReportCount > 0 &&
              ` (${issue.sensorReportCount} from phone sensors)`}
            {" · "}
            {issue.preciseLocation ? "exact spot known" : "area only"}
          </p>
        </div>

        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>

      <p className="mt-2.5 text-xs leading-relaxed text-muted">{meta.sentence}</p>

      {issue.progressSentence && (
        <p className="mt-1.5 text-xs leading-relaxed text-subtle">{issue.progressSentence}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-subtle">
        {issue.reportedByMe && (
          <span className="font-medium text-secondary">You reported this</span>
        )}
        {issue.handedOverAt && (
          <span>
            Passed to the municipal team on{" "}
            {issue.handedOverAt.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        )}
      </div>
    </li>
  );
}
