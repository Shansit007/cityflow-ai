"use client";

import { Toggle } from "@/components/ui/choice-group";
import type { StepProps } from "@/components/onboarding/types";

/**
 * STEP 4 — privacy.
 *
 * Deliberately placed LAST, once the person can see exactly what they entered,
 * rather than first as an abstract wall of text they would skip.
 *
 * It states plainly: what is collected, why, how it is used, and how to change
 * or delete it. Both switches default to on, and both can be turned off here
 * without blocking the rest of the product.
 */
export function StepPrivacy({ draft, update }: StepProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border-base bg-surface-2 p-5">
        <h3 className="text-sm font-semibold text-fg">What CityFlow AI stores</h3>

        <dl className="mt-4 space-y-4 text-sm">
          <div>
            <dt className="font-medium text-fg">The routine you just entered</dt>
            <dd className="mt-0.5 leading-relaxed text-muted">
              Areas, times, travel days, transport mode and flexibility. Stored against your
              anonymous CityFlow ID, not your name.
            </dd>
          </div>

          <div>
            <dt className="font-medium text-fg">Your email address</dt>
            <dd className="mt-0.5 leading-relaxed text-muted">
              Used only for signing in, account recovery and important service messages. It is
              never part of traffic analysis.
            </dd>
          </div>

          <div>
            <dt className="font-medium text-fg">Recommendations and your decisions</dt>
            <dd className="mt-0.5 leading-relaxed text-muted">
              What was suggested and what you chose, so you can see your own history and so the
              system can learn whether its suggestions are usable.
            </dd>
          </div>

          <div>
            <dt className="font-medium text-fg">What is not collected</dt>
            <dd className="mt-0.5 leading-relaxed text-muted">
              No exact home address, no continuous location tracking, and no contacts. Areas are
              deliberately coarse.
            </dd>
          </div>
        </dl>
      </section>

      <div className="space-y-3">
        <Toggle
          label="Count my trip in city-level demand totals"
          description="Your routine is added to anonymous totals such as “trips expected between 8:45 and 9:00 AM”. Individual travellers are never shown. Turning this off means your trip is not counted in planning figures — your own recommendations still work."
          checked={draft.shareAggregatedDemand}
          onChange={(checked) => update({ shareAggregatedDemand: checked })}
        />

        <Toggle
          label="Notify me when my recommendation changes"
          description="For example if predicted demand shifts during the day. Notifications are not implemented yet — this records your preference for when they are."
          checked={draft.allowNotifications}
          onChange={(checked) => update({ allowNotifications: checked })}
        />
      </div>

      <section className="rounded-lg border border-border-base bg-surface p-5">
        <h3 className="text-sm font-semibold text-fg">Changing or deleting this later</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Everything on these four screens can be edited at any time from{" "}
          <span className="font-medium text-fg">My profile</span>. There is nothing here you are
          locked into.
        </p>
      </section>
    </div>
  );
}
