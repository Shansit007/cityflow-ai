import { appDateOnly, appLocalDate } from "@/lib/app-time";
import type { CityCode } from "@/lib/cities";
import { prisma } from "@/lib/db";
import { dayCodeFor } from "@/lib/demand/time-slots";
import { toZoneKey } from "@/lib/demand/zones";

/**
 * Trips per origin zone for one city today — a whole-day total, with no time
 * dimension.
 *
 * WHY THIS EXISTS SEPARATELY FROM THE ADMIN HEATMAP
 * `lib/admin/analytics.ts → loadZoneDemand()` produces the same trips broken
 * down by 15-minute slot, which is what the Admin Portal's heatmap needs. Road
 * prioritisation needs only the daily total per area, and building a full
 * zone × 76-slot grid to then sum every row would be wasteful on every road
 * page load.
 *
 * ⚠️ THE COUNTING RULES BELOW ARE THE SAME RULES loadZoneDemand() USES.
 * They are repeated deliberately rather than imported, because that function
 * returns a grid and this one returns totals — but they must stay in step:
 *
 *   - a person who CONFIRMED a plan today is counted (that is fact);
 *   - a person with no confirmed plan is counted at their usual departure, but
 *     only on a day they said they travel (that is an assumption);
 *   - a person who CANCELLED today is not counted;
 *   - a person who switched off "count my trip in city-level demand totals" is
 *     not counted anywhere, ever.
 *
 * If you change one of those rules, change it in both files.
 *
 * PRIVACY: returns area names and counts. No user id leaves this function.
 */
export async function loadZoneTripTotals(cityCode: CityCode): Promise<Map<string, number>> {
  const travelDate = appDateOnly();
  const todayCode = dayCodeFor(appLocalDate());

  const [profiles, intentions] = await Promise.all([
    prisma.travelProfile.findMany({
      where: { user: { cityCode }, shareAggregatedDemand: true },
      select: { userId: true, homeArea: true, travelDays: true },
    }),
    prisma.travelIntention.findMany({
      where: { cityCode, travelDate },
      select: { userId: true, originZone: true, status: true },
    }),
  ]);

  const intentionByUser = new Map(intentions.map((row) => [row.userId, row]));
  const totals = new Map<string, number>();

  const add = (zoneKey: string) => totals.set(zoneKey, (totals.get(zoneKey) ?? 0) + 1);

  for (const profile of profiles) {
    const intention = intentionByUser.get(profile.userId);

    if (intention?.status === "CANCELLED") continue;

    if (intention?.status === "CONFIRMED") {
      add(intention.originZone);
      continue;
    }

    if (!profile.travelDays.includes(todayCode)) continue;
    add(toZoneKey(profile.homeArea));
  }

  return totals;
}

/** The busiest zone's trip count, used to scale exposure within one city. */
export function busiestZoneTrips(totals: Map<string, number>): number {
  let busiest = 0;
  for (const count of totals.values()) busiest = Math.max(busiest, count);
  return busiest;
}
