/**
 * DEMO DATA — realistic commuters for a presentation.
 *
 * ============================ WHY THIS EXISTS ===============================
 * With two real accounts the Admin Portal is honest but empty: a heatmap with
 * one row, a mode split with two bars, a demand curve that is pure baseline.
 * None of that shows what the system does. This creates enough registered
 * routines for the city-level screens to mean something.
 *
 * ========================== WHAT IT WILL NOT DO =============================
 * It does NOT fabricate results. Specifically:
 *
 *   - It never writes a recommendation the engine did not produce. It seeds
 *     each demo user's recommendation AT THEIR OWN USUAL TIME, marked PENDING,
 *     with a reason that says plainly it is a placeholder. The REAL optimiser
 *     then recalculates every one of them the next time anybody confirms a
 *     plan — which is what makes the demo worth watching, because the spreading
 *     you see is the actual engine working, not a script drawing a picture.
 *   - It never invents road issues, simulation results or repairs.
 *   - Every row it creates is removable with one command.
 *
 * ============================== SAFETY ======================================
 * Every demo account uses the reserved TLD `.invalid` (RFC 2606), which can
 * never be a real address, and a password hash of a throwaway random string so
 * nobody can sign in as one. `demo:clear` deletes exactly these accounts and
 * nothing else — it matches on the email domain, so a real user is never at
 * risk even if the counts drift.
 *
 * USAGE
 *   npm run demo:seed -- --city bhopal --users 120
 *   npm run demo:seed -- --city bhopal --users 120 --confirm 35
 *   npm run demo:clear
 * ============================================================================
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

/** The marker that makes every demo account identifiable and deletable. */
const DEMO_EMAIL_DOMAIN = "demo.cityflow.invalid";

/* -------------------------------------------------------------------------- */
/*  Real areas, so the zone breakdown is recognisable                          */
/* -------------------------------------------------------------------------- */

/*
  Real, well-known areas of each city. Using real names matters: a zone list of
  "Area 1, Area 2, Area 3" tells an audience nothing, while "Hinjewadi" and
  "Kothrud" immediately read as a commute somebody actually makes.

  Origins are residential-leaning; destinations are workplace-leaning. That is
  what produces a believable directional pattern rather than random noise.
*/
const CITY_AREAS = {
  delhi: {
    origins: ["Dwarka", "Rohini", "Saket", "Mayur Vihar", "Janakpuri", "Vasant Kunj", "Pitampura"],
    destinations: ["Connaught Place", "Nehru Place", "Noida Sector 62", "Gurgaon Cyber City", "Okhla Phase 3"],
  },
  bengaluru: {
    origins: ["Whitefield", "HSR Layout", "Jayanagar", "Hebbal", "Marathahalli", "Banashankari", "Yelahanka"],
    destinations: ["Electronic City", "Koramangala", "Indiranagar", "Manyata Tech Park", "MG Road"],
  },
  mumbai: {
    origins: ["Thane", "Borivali", "Chembur", "Navi Mumbai", "Mulund", "Kandivali", "Ghatkopar"],
    destinations: ["Bandra Kurla Complex", "Lower Parel", "Andheri East", "Powai", "Nariman Point"],
  },
  hyderabad: {
    origins: ["Kukatpally", "Miyapur", "Secunderabad", "LB Nagar", "Kompally", "Uppal"],
    destinations: ["Hitec City", "Gachibowli", "Madhapur", "Banjara Hills", "Financial District"],
  },
  pune: {
    origins: ["Kothrud", "Wakad", "Baner", "Viman Nagar", "Hadapsar", "Pimpri", "Aundh"],
    destinations: ["Hinjewadi Phase 1", "Kharadi EON", "Magarpatta City", "Shivajinagar", "Yerwada"],
  },
  bhopal: {
    origins: ["Kolar Road", "Arera Colony", "Shahpura", "Bairagarh", "Ayodhya Bypass", "Awadhpuri"],
    destinations: ["MP Nagar Zone 1", "Habibganj", "TT Nagar", "Govindpura Industrial Area", "New Market"],
  },
  chennai: {
    origins: ["Velachery", "Anna Nagar", "Adyar", "Porur", "Tambaram", "Ambattur"],
    destinations: ["OMR Sholinganallur", "T Nagar", "Guindy", "Nungambakkam", "Siruseri"],
  },
  kolkata: {
    origins: ["Behala", "Garia", "Dum Dum", "Howrah", "New Town", "Barasat", "Tollygunge"],
    destinations: ["Salt Lake Sector 5", "Park Street", "Dalhousie", "Rajarhat", "Esplanade"],
  },
};

/* -------------------------------------------------------------------------- */
/*  A deterministic random source                                              */
/* -------------------------------------------------------------------------- */

/*
  Seeded rather than Math.random(), so `--users 120` produces the SAME 120
  people every time. That matters for a demo you may rehearse and re-seed more
  than once, and it means a SUMO comparison built from this data can be
  reproduced rather than merely described.

  mulberry32: small, fast, good enough for sampling. Not for anything security
  related, and it is not used for anything security related.
*/
function makeRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (random, list) => list[Math.floor(random() * list.length)];

/** Picks from [{value, weight}] so a mode split looks like a real city's. */
function weightedPick(random, options) {
  const total = options.reduce((sum, option) => sum + option.weight, 0);
  let roll = random() * total;

  for (const option of options) {
    roll -= option.weight;
    if (roll <= 0) return option.value;
  }

  return options[options.length - 1].value;
}

/**
 * A departure time drawn from a believable commuting pattern.
 *
 * Roughly two thirds of people cluster around a morning peak, the rest are
 * spread across early starts, mid-morning and afternoon shifts. Sampling from
 * a rough bell around each centre — rather than uniformly — is what makes the
 * demand curve look like a city instead of a flat line.
 */
function sampleDeparture(random) {
  const shape = random();

  // Sum of two uniforms ≈ a triangular distribution: cheap, and close enough.
  const spread = (width) => (random() + random() - 1) * width;

  let minutes;
  if (shape < 0.62) minutes = 9 * 60 + spread(75);        // morning peak ~9:00
  else if (shape < 0.78) minutes = 7 * 60 + 30 + spread(60); // early starts
  else if (shape < 0.90) minutes = 10 * 60 + 30 + spread(70); // later starts
  else minutes = 14 * 60 + spread(120);                    // afternoon shifts

  // Clamp into a sane commuting window and snap to a 15-minute slot.
  const clamped = Math.max(5 * 60, Math.min(21 * 60, Math.round(minutes)));
  return Math.round(clamped / 15) * 15;
}

const toTime = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/* -------------------------------------------------------------------------- */
/*  Dates, matching lib/app-time.ts exactly                                     */
/* -------------------------------------------------------------------------- */

const APP_TIMEZONE = "Asia/Kolkata";

function localParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);

  const get = (type) => parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: get("weekday").toUpperCase().slice(0, 3),
  };
}

/** Midnight UTC of today's date in the app timezone — what @db.Date stores. */
function appDateOnly() {
  const { year, month, day } = localParts();
  return new Date(Date.UTC(year, month - 1, day));
}

/** "MON", "TUE"… for today in the app timezone. */
function todayDayCode() {
  return localParts().weekday;
}

/* -------------------------------------------------------------------------- */

function parseArgs(argv) {
  const args = { city: "bhopal", users: 120, confirm: 35 };

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];

    if (flag === "--city" && value) args.city = value.toLowerCase();
    if (flag === "--users" && value) args.users = Number(value);
    if (flag === "--confirm" && value) args.confirm = Number(value);
  }

  return args;
}

async function seed() {
  const { city, users, confirm } = parseArgs(process.argv.slice(2));

  const areas = CITY_AREAS[city];
  if (!areas) {
    console.error(`\n✖ Unknown city "${city}".`);
    console.error(`  Choose one of: ${Object.keys(CITY_AREAS).join(", ")}\n`);
    process.exit(1);
  }

  if (!Number.isInteger(users) || users < 1 || users > 1000) {
    console.error("\n✖ --users must be a whole number between 1 and 1000.\n");
    process.exit(1);
  }

  const existing = await prisma.user.count({
    where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } },
  });

  if (existing > 0) {
    console.log(`\n⚠ ${existing} demo account(s) already exist.`);
    console.log("  Run `npm run demo:clear` first if you want a clean set.\n");
  }

  // One hash for all of them, of a value nobody knows and nobody kept.
  const unusablePassword = await bcrypt.hash(randomUUID(), 10);

  // Seeded from the city name, so the same city always produces the same people.
  const random = makeRandom(
    [...city].reduce((total, character) => total + character.charCodeAt(0), 7919)
  );

  const travelDate = appDateOnly();
  const today = todayDayCode();

  const MODES = [
    { value: "CAR", weight: 26 },
    { value: "BIKE", weight: 30 },
    { value: "BUS", weight: 16 },
    { value: "METRO", weight: 14 },
    { value: "OTHER", weight: 8 },
    { value: "WALK", weight: 4 },
    { value: "CYCLE", weight: 2 },
  ];

  const stamp = Date.now().toString(36);
  const slotCounts = new Map();

  let created = 0;
  let confirmed = 0;

  console.log(`\nSeeding ${users} demo commuters in ${city}…`);

  for (let i = 0; i < users; i += 1) {
    const departureMinutes = sampleDeparture(random);
    const journey = 15 + Math.floor(random() * 31);          // 15-45 minutes
    const arrivalMinutes = departureMinutes + journey + 10 + Math.floor(random() * 25);

    const flexible = random() < 0.72;
    const homeArea = pick(random, areas.origins);
    const destinationArea = pick(random, areas.destinations);

    // Six-day weeks are common enough here to be worth representing.
    const travelDays =
      random() < 0.22
        ? ["MON", "TUE", "WED", "THU", "FRI", "SAT"]
        : ["MON", "TUE", "WED", "THU", "FRI"];

    const email = `demo-${stamp}-${i + 1}@${DEMO_EMAIL_DOMAIN}`;

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: unusablePassword,
        displayName: `Demo commuter ${i + 1}`,
        cityflowId: `CF-D${stamp.slice(-3).toUpperCase()}${String(i + 1).padStart(3, "0")}`,
        cityCode: city,
        onboardingCompleted: true,
        role: "USER",
        travelProfile: {
          create: {
            homeArea,
            destinationArea,
            destinationType: weightedPick(random, [
              { value: "WORK", weight: 78 },
              { value: "COLLEGE", weight: 14 },
              { value: "SCHOOL", weight: 5 },
              { value: "OTHER", weight: 3 },
            ]),
            primaryMode: weightedPick(random, MODES),
            usualDeparture: toTime(departureMinutes),
            requiredArrival: toTime(Math.min(23 * 60 + 45, arrivalMinutes)),
            typicalJourneyMinutes: journey,
            travelDays,
            isFlexible: flexible,
            flexibilityMinutes: flexible ? pick(random, [15, 30, 30, 60]) : 0,
            preferredModes: random() < 0.5 ? [weightedPick(random, MODES)] : [],
            maxAcceptableDelayMinutes: pick(random, [10, 15, 15, 30]),
            willingToLeaveEarlier: flexible && random() < 0.85,
            willingToLeaveLater: flexible && random() < 0.45,
            carpoolInterest: random() < 0.3,
            publicTransportInterest: random() < 0.45,
            // A tenth opt out, so the "excluded from city figures" path is
            // visible in the portal rather than theoretical.
            shareAggregatedDemand: random() < 0.9,
            allowNotifications: random() < 0.8,
          },
        },
      },
      select: { id: true },
    });

    created += 1;

    /*
      A PENDING recommendation at their OWN usual time.

      This is the important line in the whole script. It is not a result — it is
      the INPUT the optimiser needs. The reason field says so in plain words,
      and the moment anybody confirms a plan, reoptimiseCity() recomputes every
      one of these with the real engine. What you then see spreading across the
      morning is the actual mechanism, not a picture of it.
    */
    await prisma.recommendation.create({
      data: {
        userId: user.id,
        travelDate,
        cityCode: city,
        usualDeparture: toTime(departureMinutes),
        recommendedDeparture: toTime(departureMinutes),
        demandAtUsual: 0,
        demandAtRecommended: 0,
        reason:
          "Placeholder for demonstration data — this is simply this person's usual time. " +
          "It is replaced by a real recommendation the next time the city-wide optimiser runs.",
        status: "PENDING",
      },
    });

    /*
      A share of them have confirmed a plan for today, which is what puts real
      trips into the aggregated demand table.

      ⚠️ THEY CONFIRM THEIR USUAL TIME, AND THAT MATTERS FOR THE SUMO RESULT.

      An earlier version gave each confirmed plan a random shift of ±30 minutes.
      That quietly ruined the experiment: the SUMO export uses a confirmed
      intention in preference to a recommendation for the CITYFLOW scenario, so
      those random shifts showed up as a difference between the two runs — and
      a random ±30-minute jitter flattens a peak all by itself. The comparison
      would have been measuring the seed script's dice, not the engine.

      Confirming the usual time is also the more realistic case, and it matches
      how the optimiser treats these people: somebody who has committed is
      counted as load for everybody else and is never moved. So the only
      difference between the two scenarios stays what it must be — the times
      the recommendation engine actually chose.
    */
    if (travelDays.includes(today) && random() * 100 < confirm) {
      const updated = departureMinutes;

      await prisma.travelIntention.create({
        data: {
          userId: user.id,
          travelDate,
          cityCode: city,
          originZone: toZoneKey(homeArea),
          destinationZone: toZoneKey(destinationArea),
          plannedDeparture: toTime(departureMinutes),
          updatedDeparture: toTime(updated),
          transportMode: weightedPick(random, MODES),
          status: "CONFIRMED",
          source: "DASHBOARD",
          countedInDemand: true,
        },
      });

      slotCounts.set(updated, (slotCounts.get(updated) ?? 0) + 1);
      confirmed += 1;
    }

    if ((i + 1) % 25 === 0) console.log(`  … ${i + 1}/${users}`);
  }

  // Aggregated demand: counts only, exactly as the live path writes them.
  for (const [slotMinutes, count] of slotCounts) {
    await prisma.demandSlotAggregate.upsert({
      where: {
        cityCode_travelDate_slotMinutes: { cityCode: city, travelDate, slotMinutes },
      },
      create: { cityCode: city, travelDate, slotMinutes, confirmedTrips: count },
      update: { confirmedTrips: { increment: count } },
    });
  }

  console.log(`\n✔ Created ${created} demo commuters in ${city}.`);
  console.log(`  ${confirmed} of them have confirmed a plan for today.`);
  console.log(`  ${slotCounts.size} time slots now hold confirmed trips.\n`);

  console.log("WHAT TO DO NEXT");
  console.log("  1. Open the Admin Portal — the heatmap, zone demand and mode");
  console.log("     split are now populated with these routines.");
  console.log("  2. Sign in as YOURSELF and confirm a plan in the assistant.");
  console.log("     That runs the real optimiser across every demo");
  console.log("     recommendation — watch 'adjusted by optimiser' climb.");
  console.log("\n  Remove all of it at any time with:  npm run demo:clear\n");
}

/** Mirrors lib/demand/zones.ts — the two must agree or zones will not group. */
function toZoneKey(area) {
  return (
    area
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/ /g, "-")
      .slice(0, 80) || "unknown"
  );
}

async function clear() {
  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } },
    select: { id: true, cityCode: true },
  });

  if (demoUsers.length === 0) {
    console.log("\nNo demo accounts found. Nothing to remove.\n");
    return;
  }

  const cities = [...new Set(demoUsers.map((user) => user.cityCode).filter(Boolean))];

  /*
    Deleting the users is enough for everything hanging off them — profiles,
    recommendations, intentions and chat messages all cascade. The aggregate
    table is the exception BY DESIGN: it holds counts with no user column, so
    nothing can cascade to it. It is rebuilt from scratch below, from the
    intentions that survive.
  */
  const deleted = await prisma.user.deleteMany({
    where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } },
  });

  const travelDate = appDateOnly();

  for (const city of cities) {
    const remaining = await prisma.travelIntention.findMany({
      where: { cityCode: city, travelDate, status: "CONFIRMED" },
      select: { updatedDeparture: true },
    });

    const counts = new Map();
    for (const row of remaining) {
      const [hours, minutes] = row.updatedDeparture.split(":").map(Number);
      const slot = Math.round((hours * 60 + minutes) / 15) * 15;
      counts.set(slot, (counts.get(slot) ?? 0) + 1);
    }

    await prisma.demandSlotAggregate.deleteMany({ where: { cityCode: city, travelDate } });

    for (const [slotMinutes, confirmedTrips] of counts) {
      await prisma.demandSlotAggregate.create({
        data: { cityCode: city, travelDate, slotMinutes, confirmedTrips },
      });
    }
  }

  console.log(`\n✔ Removed ${deleted.count} demo account(s) and everything attached to them.`);
  console.log("  Aggregated demand has been rebuilt from the real plans that remain.");
  console.log("  Your own account and data are untouched.\n");
}

const mode = process.argv.includes("--clear") ? clear : seed;

mode()
  .catch((error) => {
    console.error("\n✖ Failed:", error.message, "\n");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
