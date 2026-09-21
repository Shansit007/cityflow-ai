import type { Metadata } from "next";
import Link from "next/link";

import { EmployeeManager } from "@/components/municipal/employee-manager";
import { Card, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireMunicipal } from "@/lib/auth/municipal";
import { getCity } from "@/lib/cities";
import {
  listEmployeesWithWorkload,
  loadEmployeePerformance,
} from "@/lib/municipal/municipal-service";

export const metadata: Metadata = { title: "Workforce" };

/**
 * The municipal workforce, and how the work is going.
 *
 * A NOTE ON THE PERFORMANCE TABLE
 * These figures describe WORK, not people. Mean completion time depends far
 * more on what kind of defect somebody was given and where it is than on how
 * hard they worked, so the table is presented as a workload picture — useful
 * for spotting that one person is carrying twelve open jobs while another has
 * two — and explicitly not as a ranking.
 */
export default async function MunicipalEmployeesPage() {
  const user = await requireMunicipal();
  const city = getCity(user.cityCode);

  const [employees, performance] = await Promise.all([
    listEmployeesWithWorkload(city.code),
    loadEmployeePerformance(city.code),
  ]);

  return (
    <section className="py-8 sm:py-10">
      <Container width="wide">
        <SectionHeading
          eyebrow={city.name}
          title="Workforce"
          description="The inspectors and field workers who verify and repair road defects in this city."
        />

        <div className="mt-6">
          <EmployeeManager
            employees={employees.map((employee) => ({
              id: employee.id,
              staffCode: employee.staffCode,
              name: employee.name,
              phone: employee.phone,
              email: employee.email,
              assignedArea: employee.assignedArea,
              role: employee.role,
              isActive: employee.isActive,
              openIssues: employee.openIssues,
            }))}
          />
        </div>

        {/* -------------------------------------------------- workload table */}
        {performance.length > 0 && (
          <div className="mt-8">
            <Card>
              <CardHeader
                title="Workload"
                description="How work is distributed across active employees."
              />

              {/* Tables need their own horizontal scroll on a phone. */}
              <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[38rem] text-sm">
                  <thead>
                    <tr className="border-b border-border-base text-left">
                      <th className="pb-2 font-medium text-muted">Employee</th>
                      <th className="pb-2 text-right font-medium text-muted">Open</th>
                      <th className="pb-2 text-right font-medium text-muted">Overdue</th>
                      <th className="pb-2 text-right font-medium text-muted">Completed</th>
                      <th className="pb-2 text-right font-medium text-muted">Mean time</th>
                      <th className="pb-2 text-right font-medium text-muted">Completed late</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performance.map((row) => (
                      <tr key={row.employee.id} className="border-b border-border-base last:border-0">
                        <td className="py-2.5">
                          <Link
                            href={`/municipal/employees/${row.employee.id}`}
                            className="font-medium text-fg underline-offset-2 hover:text-primary hover:underline"
                          >
                            {row.employee.name}
                          </Link>
                          <span className="ml-2 text-xs text-subtle">
                            {row.employee.staffCode}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-semibold text-fg">
                          {row.open}
                        </td>
                        <td
                          className={
                            row.overdue > 0
                              ? "py-2.5 text-right font-semibold text-traffic-high"
                              : "py-2.5 text-right text-muted"
                          }
                        >
                          {row.overdue > 0 ? row.overdue : "—"}
                        </td>
                        <td className="py-2.5 text-right text-fg">{row.completed}</td>
                        <td className="py-2.5 text-right text-muted">
                          {row.meanHours === null ? "—" : `${row.meanHours} hr`}
                        </td>
                        <td className="py-2.5 text-right text-muted">
                          {row.lateCount > 0 ? row.lateCount : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-4 text-xs leading-relaxed text-subtle">
                These figures describe the work, not the people. How long a repair takes
                depends far more on the kind of defect and where it is than on who was
                assigned it, so this is a workload picture — useful for spotting an
                unbalanced queue before assigning the next job — and not a ranking.
                &ldquo;Overdue&rdquo; is open work already past its due date;
                &ldquo;Completed late&rdquo; is finished work that missed its due date. Select
                a name for that employee&apos;s full history.
              </p>
            </Card>
          </div>
        )}
      </Container>
    </section>
  );
}
