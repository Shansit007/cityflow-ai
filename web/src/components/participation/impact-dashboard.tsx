import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ESTIMATE_CAVEAT } from "@/lib/demand/savings";
import type { ModelledImpact } from "@/lib/admin/analytics";
import type { PersonalImpact } from "@/lib/participation";

/**
 * "My CityFlow Impact" — Personal, City, and Environmental contribution,
 * built from the same estimate the Admin Portal uses (see
 * `estimateSavings`/`aggregateSavings` in demand/savings.ts), never a new
 * kind of number. Every figure here is labelled an estimate, in the same
 * place it is shown, because a number like this is exactly the kind that
 * gets remembered long after its caveat is forgotten.
 */
export function ImpactDashboard({
  personal,
  city,
  cityName,
}: {
  personal: PersonalImpact;
  city: ModelledImpact | null;
  cityName: string;
}) {
  return (
    <Card className="mt-6">
      <CardHeader
        title="My CityFlow Impact"
        description="Estimated from the demand model, not measured. See the assumptions below each figure."
        action={<Badge tone="moderate">Estimates</Badge>}
      />

      {/* --------------------------------------------------- personal impact */}
      <section>
        <h3 className="text-sm font-semibold text-fg">Personal impact</h3>

        {!personal.hasImpactData ? (
          <p className="mt-2 text-sm leading-relaxed text-muted">
            You have not yet accepted a recommendation for a journey with a light-traffic
            time on file, so there is nothing to estimate. This deliberately shows nothing
            rather than a zero — accept a suggested departure on a journey with a journey
            time set, and an estimate will appear here.
          </p>
        ) : (
          <>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <Tile
                value={String(personal.tripsOptimized)}
                caption="Trips optimized"
                detail="Confirmed plans, sent through the recommendation pipeline"
              />
              <Tile
                value={`~${personal.estimatedPersonHours} hr`}
                caption="Est. personal time saved"
                detail={`${personal.estimatedMinutesSaved} minutes, across accepted departures`}
              />
              <Tile
                value={String(personal.recommendedDeparturesFollowed)}
                caption="Recommended departures followed"
                detail="Times you took the suggested time, not a custom one"
              />
            </div>
            {personal.savingsMethod && (
              <p className="mt-3 text-xs leading-relaxed text-subtle">{personal.savingsMethod}</p>
            )}
          </>
        )}
      </section>

      {/* ------------------------------------------------------ city contribution */}
      <section className="mt-6 border-t border-border-base pt-5">
        <h3 className="text-sm font-semibold text-fg">City contribution</h3>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Tile
            value={String(personal.tripsShiftedAwayFromPeak)}
            caption="Your trips shifted away from peak"
            detail="Accepted or chose your own time, away from your usual departure"
          />
          {city && city.acceptedToday > 0 ? (
            <Tile
              value={`~${city.estimatedPersonHours} hr`}
              caption={`${cityName}, today`}
              detail={`${city.acceptedToday} commuters accepted a recommendation today — you may be one of them`}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-border-strong bg-surface-2 p-4">
              <p className="text-xs leading-relaxed text-muted">
                Nobody in {cityName} has accepted a recommendation today yet, so there is no
                city-wide figure to show for today.
              </p>
            </div>
          )}
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted">
          The city-wide figure is every commuter&apos;s contribution added together today, not
          a number attributed to you personally — it is here so you can see the shift you are
          part of.
        </p>
      </section>

      {/* --------------------------------------------------- environmental */}
      <section className="mt-6 border-t border-border-base pt-5">
        <h3 className="text-sm font-semibold text-fg">Environmental contribution</h3>

        {!personal.hasImpactData ? (
          <p className="mt-2 text-sm leading-relaxed text-muted">
            No estimate yet — this is calculated from the same accepted recommendations as
            your personal time saved, above.
          </p>
        ) : (
          <>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Tile
                value={`~${personal.estimatedFuelLitres} L`}
                caption="Est. fuel not burned"
                detail="From less time spent idling or crawling in congestion"
              />
              <Tile
                value={`~${personal.estimatedPersonHours} hr`}
                caption="Est. reduced congestion exposure"
                detail="Same figure as your personal time saved, reframed"
              />
            </div>
            <ul className="mt-3 space-y-1 text-xs leading-relaxed text-muted">
              {personal.fuelAssumptions.map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <p className="mt-5 border-t border-border-base pt-4 text-xs leading-relaxed text-subtle">
        {ESTIMATE_CAVEAT} No real journey was timed, and no emissions were measured — the
        figures above are arithmetic on a model, shown so a flexible commuter can see the
        expected size of what they are doing, not a scientific measurement of it.
      </p>
    </Card>
  );
}

function Tile({ value, caption, detail }: { value: string; caption: string; detail: string }) {
  return (
    <div className="rounded-lg border border-border-base bg-surface p-4">
      <p className="text-2xl font-semibold tracking-tight text-fg">{value}</p>
      <p className="mt-1 text-sm font-medium text-fg">{caption}</p>
      <p className="mt-0.5 text-xs text-muted">{detail}</p>
    </div>
  );
}
