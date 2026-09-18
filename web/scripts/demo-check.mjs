/**
 * A read-only health check for a demo or simulation run.
 *
 * WHY THIS EXISTS
 * Setting up a SUMO comparison has four preconditions, and when one of them is
 * wrong the only symptom is a disappointing number at the very end — after ten
 * minutes of simulation. This prints all four in one go, so a mistake is caught
 * in two seconds instead.
 *
 *   npm run demo:check
 *
 * It writes nothing. It only reads and reports.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DEMO_EMAIL_DOMAIN = "demo.cityflow.invalid";

const APP_TIMEZONE = "Asia/Kolkata";

function localParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: get("weekday").toUpperCase().slice(0, 3),
  };
}

function appDateOnly() {
  const { year, month, day } = localParts();
  return new Date(Date.UTC(year, month - 1, day));
}

const tick = (ok) => (ok ? "✔" : "✖");

async function main() {
  const travelDate = appDateOnly();
  const today = localParts().weekday;

  console.log("\n" + "=".repeat(64));
  console.log("  CITYFLOW AI — demo and simulation readiness check");
  console.log("=".repeat(64));
  console.log(`  Date ${travelDate.toISOString().slice(0, 10)} (${today})\n`);

  /* ---------------------------------------------- 1. real accounts ------- */
  const realUsers = await prisma.user.findMany({
    where: { email: { not: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } } },
    select: {
      email: true,
      cityflowId: true,
      cityCode: true,
      role: true,
      travelProfile: { select: { homeArea: true, destinationArea: true } },
    },
  });

  console.log("  YOUR ACCOUNTS");
  if (realUsers.length === 0) {
    console.log("    ✖ none found");
  }
  for (const user of realUsers) {
    const route = user.travelProfile
      ? `${user.travelProfile.homeArea} → ${user.travelProfile.destinationArea}`
      : "no routine set up";
    console.log(
      `    ${user.cityflowId}  ${user.role.padEnd(5)}  city=${String(user.cityCode).padEnd(10)}  ${route}`
    );
  }

  /* ---------------------------------------------- 2. demo population ----- */
  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } },
    select: { cityCode: true },
  });

  const byCity = new Map();
  for (const user of demoUsers) {
    byCity.set(user.cityCode, (byCity.get(user.cityCode) ?? 0) + 1);
  }

  console.log("\n  DEMO COMMUTERS");
  if (byCity.size === 0) {
    console.log("    ✖ none — run:  npm run demo:seed -- --city bhopal --users 600");
  }
  for (const [city, count] of byCity) {
    console.log(`    ${String(city).padEnd(12)} ${count}`);
  }

  /* ---------------------------------------------- 3. per city ------------ */
  const cities = [...new Set([...byCity.keys(), ...realUsers.map((u) => u.cityCode)])].filter(
    Boolean
  );

  for (const city of cities) {
    const [total, optimised, confirmed, cancelled, slots, roadIssues] = await Promise.all([
      prisma.recommendation.count({ where: { cityCode: city, travelDate } }),
      prisma.recommendation.count({
        where: { cityCode: city, travelDate, updatedByOptimiser: true },
      }),
      prisma.travelIntention.count({
        where: { cityCode: city, travelDate, status: "CONFIRMED" },
      }),
      prisma.travelIntention.count({
        where: { cityCode: city, travelDate, status: "CANCELLED" },
      }),
      prisma.demandSlotAggregate.count({ where: { cityCode: city, travelDate } }),
      prisma.roadIssue.count({ where: { cityCode: city } }),
    ]);

    /*
      What the SUMO export would actually contain. It mirrors the rules in
      lib/admin/sumo-export.ts: only people who share their demand, only road
      vehicles, and only people travelling today.
    */
    const profiles = await prisma.travelProfile.findMany({
      where: { user: { cityCode: city }, shareAggregatedDemand: true },
      select: { travelDays: true, primaryMode: true },
    });

    const ROAD_MODES = new Set(["CAR", "BIKE", "BUS", "OTHER"]);
    const exportable = profiles.filter(
      (p) => p.travelDays.includes(today) && ROAD_MODES.has(p.primaryMode)
    ).length;

    console.log(`\n  ${String(city).toUpperCase()}`);
    console.log(`    ${tick(total > 0)} recommendations today       ${total}`);
    console.log(`    ${tick(optimised > 0)} adjusted by the optimiser   ${optimised}`);
    console.log(`    ${tick(true)} confirmed plans             ${confirmed}${cancelled ? `  (${cancelled} cancelled)` : ""}`);
    console.log(`    ${tick(true)} slots holding trips         ${slots}`);
    console.log(`    ${tick(exportable > 20)} trips a SUMO export would hold  ${exportable}`);
    if (roadIssues > 0) console.log(`      road issues reported        ${roadIssues}`);

    if (optimised === 0 && total > 0) {
      console.log("      ⚠ The optimiser has not run for this city today.");
      console.log("        Both SUMO scenarios would be identical — the CITYFLOW file");
      console.log("        would just be everyone's usual time.");
      console.log("        Fix: sign in as an account whose city is this one, open");
      console.log("        Saarthi and confirm a plan.");
    }
  }

  /* ---------------------------------------------- 4. the verdict --------- */
  console.log("\n" + "-".repeat(64));
  console.log("  READY FOR A SUMO RUN?");
  console.log("-".repeat(64));

  let ready = false;

  for (const city of cities) {
    const optimised = await prisma.recommendation.count({
      where: { cityCode: city, travelDate, updatedByOptimiser: true },
    });
    const demoHere = byCity.get(city) ?? 0;
    const mine = realUsers.filter((u) => u.cityCode === city).length;

    if (demoHere >= 50 && optimised > 0) {
      ready = true;
      console.log(`    ✔ ${city}: ${demoHere} commuters, ${optimised} recommendations moved by the engine.`);
      console.log(`      Export both trip files with ${city} selected, then run the comparison.`);
    } else if (demoHere >= 50) {
      console.log(`    ✖ ${city}: ${demoHere} commuters, but the optimiser has not run.`);
      console.log(`      ${mine > 0 ? "Confirm a plan in Saarthi" : "No account of yours is in this city — move your profile here first, then confirm a plan"}.`);
    }
  }

  if (!ready && cities.length > 0) {
    console.log("\n    Nothing is ready yet. Work through the two lines above.");
  }

  console.log();
}

main()
  .catch((error) => {
    console.error("\n✖ Check failed:", error.message, "\n");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
