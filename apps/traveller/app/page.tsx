import { AppShell, Card } from "@cityflow/ui";

import { CityChooser } from "@/components/city-chooser";
import { InflowDiagram } from "@/components/inflow-diagram";
import { SignedOutNav } from "@/components/traveller-nav";

export default function HomePage() {
  return (
    <AppShell productName="CityFlow AI" nav={<SignedOutNav />}>
      <section className="max-w-2xl">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Congestion is an arrival-rate problem, not a routing problem.
        </h1>

        <div className="mt-5 space-y-4 text-[var(--ink-muted)]">
          <p>
            A road jams when more vehicles enter it in a quarter of an hour than it can
            absorb. Navigation apps route you around a jam that already exists. CityFlow
            AI works one step earlier, spreading departure times so the jam does not form.
          </p>
          <p className="text-[var(--ink)]">
            It tells you when to leave, not which way to go.
          </p>
        </div>

        <CityChooser />

        <p className="mt-3 text-xs text-[var(--ink-muted)]">
          No name, no email, no phone number. Recommendations are advisory; nothing here
          restricts when anyone may travel.
        </p>
      </section>

      <section className="mt-14 max-w-3xl">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--ink-muted)]">
          How it works
        </h2>
        <div className="mt-5">
          <InflowDiagram />
        </div>
      </section>

      <section className="mt-14 grid max-w-3xl gap-4 sm:grid-cols-3">
        <Explainer title="It plans the whole city, not you alone">
          Telling every commuter the same quiet moment just moves the peak. Departures are
          allocated against each segment&rsquo;s remaining capacity, so no two people are
          sent into the same gap.
        </Explainer>
        <Explainer title="Most people are not using it">
          The allocator assumes it controls a minority of the road and plans around
          everyone else, because that is the situation any real deployment starts in.
        </Explainer>
        <Explainer title="It should not always be you">
          Being shifted yesterday makes you more expensive to shift today, so the same
          flexible commuters do not absorb the whole problem.
        </Explainer>
      </section>
    </AppShell>
  );
}

function Explainer({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-[var(--ink-muted)]">{children}</p>
    </Card>
  );
}
