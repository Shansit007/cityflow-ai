/**
 * Run the city-wide optimiser, and explain what it did.
 *
 *   npm run demo:optimise -- --city bhopal
 *
 * Calls POST /api/admin/reoptimise — the same `reoptimiseCity()` the product
 * runs when somebody confirms a plan. Nothing is reimplemented here; this is a
 * trigger and a report, so what you measure is always the real engine.
 *
 * Authenticates by signing a short-lived session token with AUTH_SECRET, the
 * way lib/auth/jwt.ts does, for an admin that already exists.
 * The dev server must be running.
 */

import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

const prisma = new PrismaClient();
const SESSION_COOKIE_NAME = "cityflow_session";

function parseArgs(argv) {
  const args = { city: "bhopal", url: "http://localhost:3000" };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--city" && argv[i + 1]) args.city = argv[i + 1].toLowerCase();
    if (argv[i] === "--url" && argv[i + 1]) args.url = argv[i + 1].replace(/\/$/, "");
  }
  return args;
}

function bar(value, total, width = 34) {
  if (total === 0) return "";
  const filled = Math.round((value / total) * width);
  return "█".repeat(filled) + "·".repeat(width - filled);
}

async function main() {
  const { city, url } = parseArgs(process.argv.slice(2));

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true, cityflowId: true, role: true },
  });

  if (!admin) {
    throw new Error(
      "No admin account exists.\n  Create one with:  npm run admin:create -- your-email@example.com"
    );
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET is missing or too short in web/.env.");
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ cityflowId: admin.cityflowId, role: admin.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(admin.id)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 600)
    .sign(new TextEncoder().encode(secret));

  console.log(`\nRe-optimising ${city} …  (this may take a minute)\n`);

  const response = await fetch(`${url}/api/admin/reoptimise?city=${city}`, {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`${data.error ?? response.statusText} (HTTP ${response.status})`);
  }

  const { considered, updated, breakdown, missedByImprovement } = data;

  console.log("=".repeat(60));
  console.log(`  RE-OPTIMISATION — ${data.cityName}   (${data.tookMs} ms)`);
  console.log("=".repeat(60));
  console.log(`  Recommendations examined   ${considered}`);
  console.log(`  Moved by the engine        ${updated}`);
  console.log();
  console.log("  WHY THE REST STAYED PUT");
  const rows = [
    ["moved", breakdown.moved],
    ["already committed", breakdown.alreadyCommitted],
    ["departure is fixed", breakdown.notFlexible],
    ["nothing better nearby", breakdown.noWorthwhileSlot],
    ["no travel routine", breakdown.noProfile],
  ];
  for (const [label, value] of rows) {
    console.log(`    ${label.padEnd(24)}${String(value).padStart(5)}  ${bar(value, considered)}`);
  }

  const missed = missedByImprovement;
  const totalMissed = missed.none + missed.under4 + missed.under8;

  if (totalMissed > 0) {
    console.log();
    console.log("  OF THOSE WITH 'NOTHING BETTER NEARBY',");
    console.log("  how close the best alternative came to being worth taking:");
    console.log(`    no better slot at all      ${String(missed.none).padStart(5)}`);
    console.log(`    better by under 4 points   ${String(missed.under4).padStart(5)}`);
    console.log(`    better by 4-8 points       ${String(missed.under8).padStart(5)}  <-- blocked by the threshold`);
    console.log();
    console.log("    The engine only suggests a change when a slot is at least 8");
    console.log("    index points quieter. Anyone in that last row had a genuinely");
    console.log("    better option and was held back by that constant alone.");
  }

  if (data.overloadedSlotsBefore?.length || data.overloadedSlotsAfter?.length) {
    console.log();
    console.log(`  Slots over capacity: ${data.overloadedSlotsBefore.length} before, ${data.overloadedSlotsAfter.length} after`);
  }

  console.log();

  if (updated === 0) {
    console.log("  ⚠ Nothing moved. A SUMO comparison would show no difference,");
    console.log("    because the CITYFLOW file would be everyone's usual time.\n");
  } else {
    console.log("  NEXT:");
    console.log(`    npm run sumo:export -- --city ${city}`);
    console.log("    cd scripts/sumo && ./run-comparison.sh city.osm.xml baseline.trips.xml cityflow.trips.xml\n");
  }
}

main()
  .catch((error) => {
    console.error(`\n✖ ${error.message}\n`);
    if (String(error.message).includes("fetch failed")) {
      console.error("  Is the dev server running?  npm run dev\n");
    }
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
