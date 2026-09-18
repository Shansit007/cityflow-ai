import { appDateOnly, appDateKey, appLocalDate } from "@/lib/app-time";
import type { CityCode } from "@/lib/cities";
import { prisma } from "@/lib/db";
import { SLOT_MINUTES, dayCodeFor, roundToSlot, toMinutes } from "@/lib/demand/time-slots";
import { toZoneKey } from "@/lib/demand/zones";
import type { TransportMode } from "@/lib/travel";

/**
 * EXPORTING DEMAND FOR SUMO.
 *
 * ============================== WHAT IS REAL ================================
 * CityFlow AI does not run SUMO. SUMO is a desktop traffic simulator; a
 * serverless web app cannot host it, and claiming otherwise would be a lie.
 *
 * What this file does is the part the web application genuinely owns: turn the
 * demand it holds into files SUMO can actually read. The evaluation loop is:
 *
 *   1. Build a road network from OpenStreetMap with `netconvert`.
 *   2. Export demand from here, twice — BASELINE and CITYFLOW.
 *   3. Route and run both with `duarouter` and `sumo`.
 *   4. Paste the metrics back into the Admin Portal to compare them.
 *
 * Steps 1, 3 and 4 happen outside this application. Step 2 is this file, and
 * the exact commands for the rest are in docs/04-SUMO-EVALUATION.md.
 * ============================================================================
 *
 * THE TWO SCENARIOS
 *   BASELINE  — every traveller departs at their normal time. The "no CityFlow
 *               AI" day, and the thing any claimed improvement is measured against.
 *   CITYFLOW  — travellers depart at the time CityFlow AI recommended, or at the
 *               time they confirmed if they confirmed one.
 *
 * Same people, same origins, same destinations, same total number of trips.
 * The ONLY difference between the two files is departure time. That is what
 * makes the comparison mean something: any difference in the results is caused
 * by demand smoothing and nothing else.
 */

export type SimulationScenario = "BASELINE" | "CITYFLOW";

/** One vehicle in the export. */
export interface ExportedTrip {
  id: string;
  /** Departure time in seconds since midnight, which is what SUMO expects. */
  departSeconds: number;
  fromTaz: string;
  toTaz: string;
  /** SUMO vehicle class. */
  vType: string;
}

/**
 * Which travel modes occupy road space.
 *
 * Metro, walking and cycling are deliberately EXCLUDED from the road network
 * simulation. They are real trips, and they matter to the product — but they do
 * not consume the road capacity SUMO is modelling, and including them would
 * inflate the vehicle count and make both scenarios look worse than they are.
 * This mirrors the `roadImpact` classification in lib/travel.ts.
 */
const SUMO_VEHICLE_TYPE: Partial<Record<TransportMode, string>> = {
  CAR: "passenger",
  BIKE: "motorcycle",
  BUS: "bus",
  OTHER: "passenger", // auto, cab, shared vehicle
};

/**
 * Spreads vehicles across the 15 minutes of their slot.
 *
 * Every vehicle departing at exactly 08:45:00 would create an artificial
 * shockwave that says more about the export than about the traffic. Spacing
 * them evenly across the slot is the standard treatment, and it is
 * deterministic so two exports of the same data are byte-identical.
 */
function departureSecond(slotMinutes: number, indexInSlot: number, countInSlot: number): number {
  const slotStart = slotMinutes * 60;
  const spacing = (SLOT_MINUTES * 60) / Math.max(1, countInSlot);
  return Math.round(slotStart + indexInSlot * spacing);
}

/**
 * Builds the trip list for one scenario.
 *
 * Only people who agreed to be counted in city-level figures are included —
 * the same `shareAggregatedDemand` promise the Admin Portal honours everywhere.
 */
export async function buildTrips(
  cityCode: CityCode,
  scenario: SimulationScenario
): Promise<ExportedTrip[]> {
  const travelDate = appDateOnly();
  const todayCode = dayCodeFor(appLocalDate());

  const [profiles, intentions, recommendations] = await Promise.all([
    prisma.travelProfile.findMany({
      where: { user: { cityCode }, shareAggregatedDemand: true },
      select: {
        userId: true,
        homeArea: true,
        destinationArea: true,
        usualDeparture: true,
        travelDays: true,
        primaryMode: true,
      },
    }),
    prisma.travelIntention.findMany({
      where: { cityCode, travelDate },
      select: {
        userId: true,
        updatedDeparture: true,
        status: true,
        transportMode: true,
      },
    }),
    prisma.recommendation.findMany({
      where: { cityCode, travelDate },
      select: { userId: true, recommendedDeparture: true },
    }),
  ]);

  const intentionByUser = new Map(intentions.map((row) => [row.userId, row]));
  const recommendationByUser = new Map(
    recommendations.map((row) => [row.userId, row.recommendedDeparture])
  );

  // First pass: decide each person's departure slot and mode.
  interface Pending {
    slot: number;
    fromTaz: string;
    toTaz: string;
    mode: TransportMode;
  }

  const pending: Pending[] = [];

  for (const profile of profiles) {
    const intention = intentionByUser.get(profile.userId);

    // Not travelling today — excluded from both scenarios equally.
    if (intention?.status === "CANCELLED") continue;

    // Someone whose routine does not include today, and who has not confirmed
    // anything, is not on the road today.
    if (!intention && !profile.travelDays.includes(todayCode)) continue;

    const mode = (intention?.transportMode ?? profile.primaryMode) as TransportMode;
    if (!SUMO_VEHICLE_TYPE[mode]) continue; // not a road vehicle

    // BASELINE always uses the normal routine — that is the entire point of it.
    // CITYFLOW uses what they confirmed, or failing that what was recommended.
    const departureText =
      scenario === "BASELINE"
        ? profile.usualDeparture
        : (intention?.status === "CONFIRMED" ? intention.updatedDeparture : null) ??
          recommendationByUser.get(profile.userId) ??
          profile.usualDeparture;

    const minutes = toMinutes(departureText);
    if (minutes === null) continue;

    pending.push({
      slot: roundToSlot(minutes),
      fromTaz: toZoneKey(profile.homeArea),
      toTaz: toZoneKey(profile.destinationArea),
      mode,
    });
  }

  // Second pass: order by slot, then spread within each slot.
  pending.sort((a, b) =>
    a.slot !== b.slot
      ? a.slot - b.slot
      : `${a.fromTaz}${a.toTaz}`.localeCompare(`${b.fromTaz}${b.toTaz}`)
  );

  const countsPerSlot = new Map<number, number>();
  for (const item of pending) {
    countsPerSlot.set(item.slot, (countsPerSlot.get(item.slot) ?? 0) + 1);
  }

  const seenPerSlot = new Map<number, number>();
  const trips: ExportedTrip[] = [];

  pending.forEach((item, index) => {
    const seen = seenPerSlot.get(item.slot) ?? 0;
    seenPerSlot.set(item.slot, seen + 1);

    trips.push({
      id: `cf_${scenario.toLowerCase()}_${index}`,
      departSeconds: departureSecond(item.slot, seen, countsPerSlot.get(item.slot) ?? 1),
      fromTaz: item.fromTaz,
      toTaz: item.toTaz,
      vType: SUMO_VEHICLE_TYPE[item.mode]!,
    });
  });

  return trips;
}

/** Escapes a value for safe inclusion in XML. */
function xmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * A SUMO trip-definition file.
 *
 * Trips reference TAZ ids rather than edge ids, so this file is valid without
 * knowing anything about the road network. `duarouter` resolves the TAZs into
 * real edges using the TAZ file below.
 */
/*
  ⚠️ NOTHING IN THE HEADER COMMENT BELOW MAY CONTAIN A DOUBLE HYPHEN.

  XML forbids "--" inside a comment — the sequence is what ends one. An earlier
  version of this header printed an example command line containing
  "duarouter ... --taz-files ...", which made every exported file invalid XML.
  SUMO's own parser and Python's both reject it, so the files were unusable at
  the very first step of the pipeline.

  It is an easy mistake to make again, because the offending text reads
  perfectly well to a human. If you add a command-line example here, describe
  the flags in words rather than writing them out.
*/
export function tripsToXml(
  trips: ExportedTrip[],
  scenario: SimulationScenario,
  cityCode: CityCode
): string {
  const header = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<!--",
    `  CityFlow AI demand export`,
    `  City       : ${cityCode}`,
    `  Date       : ${appDateKey()}`,
    `  Scenario   : ${scenario}`,
    `  Vehicles   : ${trips.length}`,
    "",
    "  BASELINE = everyone departs at their normal time.",
    "  CITYFLOW = departures follow CityFlow AI's recommendations.",
    "  Both files contain the same travellers and the same origin/destination",
    "  pairs. Only the departure times differ.",
    "",
    "  Metro, walking and cycling trips are excluded: they are real trips but",
    "  they do not occupy road capacity.",
    "",
    "  Next step: route this file with duarouter, passing the network, the",
    "  zone file and this file. See docs/04-SUMO-EVALUATION.md, or just run",
    "  web/scripts/sumo/run-comparison.sh which does the whole pipeline.",
    "-->",
    "<routes>",
    '  <vType id="passenger" vClass="passenger" />',
    '  <vType id="motorcycle" vClass="motorcycle" />',
    '  <vType id="bus" vClass="bus" />',
    "",
  ];

  const body = trips.map(
    (trip) =>
      `  <trip id="${xmlAttr(trip.id)}" type="${trip.vType}" depart="${trip.departSeconds}.00" ` +
      `fromTaz="${xmlAttr(trip.fromTaz)}" toTaz="${xmlAttr(trip.toTaz)}" />`
  );

  return [...header, ...body, "</routes>", ""].join("\n");
}

/**
 * A TAZ (traffic assignment zone) template.
 *
 * THE ONE THING THIS FILE CANNOT KNOW is which network edges belong to each
 * zone — those ids only exist once `netconvert` has built a network from an
 * OpenStreetMap extract. So the export emits every zone with an empty `edges`
 * attribute and says plainly that it has to be filled in.
 *
 * Emitting a plausible-looking guess would be worse than useless: the
 * simulation would run and produce numbers that mean nothing.
 */
export function zonesToTazTemplate(trips: ExportedTrip[], cityCode: CityCode): string {
  const zones = [...new Set(trips.flatMap((trip) => [trip.fromTaz, trip.toTaz]))].sort();

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<!--",
    `  CityFlow AI zone template — ${cityCode}`,
    "",
    "  FILL IN THE edges ATTRIBUTES BEFORE USING THIS FILE.",
    "",
    "  Each zone below is an area name a CityFlow AI user entered. To turn it",
    "  into a usable TAZ, list the network edge ids that fall inside that area,",
    "  space separated:",
    "",
    '    <taz id="park-street" edges="-123#0 -123#1 456#2" />',
    "",
    "  You can find edge ids by opening your .net.xml in SUMO's netedit.",
    "",
    "  CityFlow AI cannot generate these for you: edge ids only exist once you",
    "  have built a network from an OpenStreetMap extract, and a guessed value",
    "  would produce a simulation that runs but means nothing.",
    "-->",
    "<additional>",
    ...zones.map((zone) => `  <taz id="${xmlAttr(zone)}" edges="" />`),
    "</additional>",
    "",
  ].join("\n");
}

/** A plain origin/destination table, for anyone building their own pipeline. */
export function tripsToOdCsv(trips: ExportedTrip[]): string {
  const counts = new Map<string, number>();

  for (const trip of trips) {
    // Group back into 15-minute slots for a readable matrix.
    const slot = Math.floor(trip.departSeconds / (SLOT_MINUTES * 60)) * SLOT_MINUTES;
    const key = `${trip.fromTaz}|${trip.toTaz}|${slot}|${trip.vType}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const rows = [...counts.entries()]
    .map(([key, count]) => {
      const [from, to, slot, vType] = key.split("|");
      const minutes = Number(slot);
      const time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
        minutes % 60
      ).padStart(2, "0")}`;
      return { from, to, time, minutes, vType, count };
    })
    .sort((a, b) => a.minutes - b.minutes || a.from.localeCompare(b.from));

  return [
    "origin_zone,destination_zone,slot_start,vehicle_type,trips",
    ...rows.map((row) => `${row.from},${row.to},${row.time},${row.vType},${row.count}`),
    "",
  ].join("\n");
}
