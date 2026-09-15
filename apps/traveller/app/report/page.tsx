import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@cityflow/ui";

import { DefectReporter } from "@/components/defect-reporter";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ReportPage() {
  const session = await readSession();
  if (!session) redirect("/");

  return (
    <AppShell
      productName="CityFlow AI"
      nav={
        <Link href="/today" className="text-[var(--ink-muted)] hover:text-[var(--ink)]">
          Today
        </Link>
      }
    >
      <h1 className="text-2xl font-semibold tracking-tight">Report road defects</h1>

      <div className="mt-4 max-w-xl space-y-4 text-sm text-[var(--ink-muted)]">
        <p>
          With your phone mounted in a vehicle, this watches how the road shakes it and
          flags the jolts that look like a hole rather than a speed bump. It needs the
          phone reasonably fixed in place — loose in a pocket, most of what it measures is
          you.
        </p>
        <p>
          A jolt you record is not a defect. It becomes one only when several travellers
          independently register something at the same place, which is what keeps one bad
          mount and one unfamiliar speed table out of the council&rsquo;s queue.
        </p>
        <p className="text-[var(--ink)]">
          Your exact position is sent for this feature, unlike everywhere else in
          CityFlow. A pothole has to be findable. Those readings are deleted once they
          have been aggregated.
        </p>
      </div>

      <div className="mt-8">
        <DefectReporter />
      </div>

      <div className="mt-8 max-w-xl text-xs text-[var(--ink-muted)]">
        <h2 className="font-medium text-[var(--ink)]">What this cannot do</h2>
        <p className="mt-2">
          Browsers cap motion sampling well below what a dedicated sensor app gets, and
          throttle it further when the screen is off or the tab is in the background, so
          leave this page open. Detection quality depends heavily on how the phone is
          mounted and on the vehicle&rsquo;s suspension; a scooter and a bus travelling
          the same road do not record the same thing. docs/architecture.md keeps the full
          list.
        </p>
      </div>
    </AppShell>
  );
}
