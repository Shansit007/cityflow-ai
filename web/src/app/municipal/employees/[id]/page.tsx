import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { requireMunicipal } from "@/lib/auth/municipal";
import { getCity } from "@/lib/cities";
import { getEmployeeDetail } from "@/lib/municipal/municipal-service";
import { STATUS_META } from "@/lib/municipal/workflow";
import { issueTypeLabel } from "@/lib/roads/types";

export const metadata: Metadata = { title: "Employee" };

const ROLE_LABEL = {
  FIELD_WORKER: "Field worker",
  INSPECTOR: "Inspector",
  SUPERVISOR: "Supervisor",
} as const;

/**
 * One employee: who they are, their workload, and every job that has ever
 * touched their name.
 *
 * WHY A DEACTIVATED EMPLOYEE CAN STILL BE OPENED HERE
 * `deactivateEmployee` is explicit that it is not a delete — the whole reason
 * is that their name stays correct in the audit trail of every issue they
 * touched. A page that 404s the moment someone leaves would make that audit
 * trail unreachable exactly when a question about old work is most likely to
 * come up, so this page reads by id regardless of `isActive` and simply shows
 * the badge honestly.
 *
 * THE SAME FIGURES-ARE-NOT-A-RANKING NOTE AS THE WORKLOAD TABLE
 * How long a repair took depends far more on the kind of defect and where it
 * was than on who did it, so this page states that again rather than let the
 * numbers speak for themselves out of context.
 */
export default async function MunicipalEmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireMunicipal();
  const city = getCity(user.cityCode);
  const { id } = await params;

  const detail = await getEmployeeDetail(city.code, id);
  if (!detail) notFound();

  const { employee, assigned, verified, stats } = detail;

  return (
    <section className="py-8 sm:py-10">
      <Container width="wide">
        <Link href="/municipal/employees" className="text-sm font-medium text-primary underline">
          ← Back to workforce
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-fg">{employee.name}</h1>
              <Badge tone="neutral">{employee.staffCode}</Badge>
              <Badge tone={employee.role === "SUPERVISOR" ? "primary" : "secondary"}>
                {ROLE_LABEL[employee.role]}
              </Badge>
              {!employee.isActive && <Badge tone="neutral">Inactive</Badge>}
            </div>
            <p className="mt-1.5 text-sm text-muted">
              {employee.assignedArea ?? "No area assigned"}
              {employee.phone && (
                <>
                  <span className="mx-1.5" aria-hidden="true">
                    ·
                  </span>
                  {employee.phone}
                </>
              )}
              {employee.email && (
                <>
                  <span className="mx-1.5" aria-hidden="true">
                    ·
                  </span>
                  {employee.email}
                </>
              )}
            </p>
          </div>
        </div>

        {/* -------------------------------------------------------- workload */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatTile label="Open jobs" value={String(stats.open)} detail="Assigned, not yet finished" />
          <StatTile
            label="Overdue now"
            value={String(stats.overdue)}
            detail="Open and past its due date"
            alert={stats.overdue > 0}
          />
          <StatTile label="Completed" value={String(stats.completed)} />
          <StatTile
            label="Mean repair time"
            value={stats.meanHours === null ? "—" : `${stats.meanHours} hr`}
            detail="Assigned to completed"
          />
          <StatTile
            label="Completed late"
            value={stats.lateCount > 0 ? String(stats.lateCount) : "0"}
            detail="Finished after its due date"
          />
          <StatTile label="Inspections" value={String(stats.totalVerified)} detail="Verified by this employee" />
        </div>

        <p className="mt-3 text-xs leading-relaxed text-subtle">
          These figures describe the work, not the person. How long a repair takes depends far
          more on the kind of defect and where it is than on who was assigned it.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* --------------------------------------------------- assigned work */}
          <Card>
            <CardHeader
              title={`Assigned work (${assigned.length})`}
              description="Every issue ever assigned to this employee, most recent first."
            />

            {assigned.length === 0 ? (
              <p className="text-sm text-muted">No work has been assigned yet.</p>
            ) : (
              <ul className="space-y-3">
                {assigned.map((issue) => {
                  const meta = STATUS_META[issue.status];
                  return (
                    <li key={issue.id}>
                      <Link
                        href={`/municipal/issues/${issue.id}`}
                        className="block rounded-lg border border-border-base bg-surface-2 p-3 transition-colors hover:bg-surface-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-fg">
                            {issueTypeLabel(issue.issueType)}
                            <span className="mx-1.5 text-border-strong" aria-hidden="true">
                              ·
                            </span>
                            <span className="font-normal text-muted">{issue.areaLabel}</span>
                          </p>
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                        </div>
                        <p className="mt-1.5 text-xs text-subtle">
                          {issue.assignedAt
                            ? `Assigned ${issue.assignedAt.toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                              })}`
                            : "Assignment date unknown"}
                          {issue.dueAt && (
                            <>
                              {" · due "}
                              {issue.dueAt.toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                              })}
                            </>
                          )}
                          {" · priority "}
                          {issue.priorityScore}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* --------------------------------------------------- inspections */}
          <Card>
            <CardHeader
              title={`Inspections (${verified.length})`}
              description="Issues this employee personally verified as a real defect."
            />

            {verified.length === 0 ? (
              <p className="text-sm text-muted">No inspections recorded yet.</p>
            ) : (
              <ul className="space-y-3">
                {verified.map((issue) => {
                  const meta = STATUS_META[issue.status];
                  return (
                    <li key={issue.id}>
                      <Link
                        href={`/municipal/issues/${issue.id}`}
                        className="block rounded-lg border border-border-base bg-surface-2 p-3 transition-colors hover:bg-surface-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-fg">
                            {issueTypeLabel(issue.issueType)}
                            <span className="mx-1.5 text-border-strong" aria-hidden="true">
                              ·
                            </span>
                            <span className="font-normal text-muted">{issue.areaLabel}</span>
                          </p>
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                        </div>
                        <p className="mt-1.5 text-xs text-subtle">
                          {issue.verifiedAt
                            ? `Verified ${issue.verifiedAt.toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}`
                            : "Verification date unknown"}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </Container>
    </section>
  );
}

function StatTile({
  label,
  value,
  detail,
  alert = false,
}: {
  label: string;
  value: string;
  detail?: string;
  alert?: boolean;
}) {
  return (
    <div
      className={
        alert
          ? "rounded-card border border-traffic-high bg-surface p-4 shadow-card"
          : "rounded-card border border-border-base bg-surface p-4 shadow-card"
      }
    >
      <p className="text-xs font-medium uppercase tracking-wider text-subtle">{label}</p>
      <p
        className={
          alert
            ? "mt-1 text-2xl font-semibold tracking-tight text-traffic-high"
            : "mt-1 text-2xl font-semibold tracking-tight text-fg"
        }
      >
        {value}
      </p>
      {detail && <p className="mt-0.5 text-xs text-muted">{detail}</p>}
    </div>
  );
}
