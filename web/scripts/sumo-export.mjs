/**
 * Download the two SUMO trip files without going through a browser.
 *
 * ============================== WHY THIS EXISTS =============================
 * The trip files come from an admin-only API route, so the browser is the
 * natural way to get them — you are already signed in there. Except browsers
 * are unhelpfully varied about WHERE a download lands, and a file you cannot
 * find is as good as a file you never downloaded. That cost us several rounds.
 *
 * ============================== HOW IT WORKS ================================
 * It does NOT reimplement the export. Reimplementing it would mean two copies
 * of the trip-building rules, which would drift apart and quietly produce a
 * simulation that no longer matched the application.
 *
 * Instead it calls the SAME endpoint the Admin Portal calls, and authenticates
 * the way the application does: by signing a short-lived session token with
 * AUTH_SECRET, exactly as lib/auth/jwt.ts does, for an admin account that
 * already exists in the database. Same route, same code, same output —
 * written straight into scripts/sumo/ where the comparison script expects it.
 *
 * The token is created in memory, used for two requests, and never stored.
 *
 * USAGE
 *   npm run sumo:export -- --city bhopal
 *   npm run sumo:export -- --city bhopal --url http://localhost:3001
 *
 * The dev server must be running.
 * ============================================================================
 */

import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();

const SESSION_COOKIE_NAME = "cityflow_session";
const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(HERE, "sumo");

function parseArgs(argv) {
  const args = { city: "bhopal", url: "http://localhost:3000" };

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--city" && argv[i + 1]) args.city = argv[i + 1].toLowerCase();
    if (argv[i] === "--url" && argv[i + 1]) args.url = argv[i + 1].replace(/\/$/, "");
  }

  return args;
}

/** Signs a session token the same way lib/auth/jwt.ts does. */
async function mintToken(user) {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or too short in web/.env. It must be at least 32 characters."
    );
  }

  const issuedAt = Math.floor(Date.now() / 1000);

  return new SignJWT({ cityflowId: user.cityflowId, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt(issuedAt)
    // Ten minutes is more than enough for two downloads.
    .setExpirationTime(issuedAt + 600)
    .sign(new TextEncoder().encode(secret));
}

async function download(baseUrl, token, city, scenario) {
  const url = `${baseUrl}/api/admin/simulation/export?scenario=${scenario}&format=trips&city=${city}`;

  const response = await fetch(url, {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `${scenario} export failed (HTTP ${response.status}).\n  ${body.slice(0, 200)}`
    );
  }

  const text = await response.text();
  const trips = (text.match(/<trip /g) ?? []).length;

  const path = join(OUTPUT_DIR, `${scenario.toLowerCase()}.trips.xml`);
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(path, text, "utf-8");

  return { path, trips };
}

async function main() {
  const { city, url } = parseArgs(process.argv.slice(2));

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true, cityflowId: true, role: true, email: true },
  });

  if (!admin) {
    throw new Error(
      "No admin account exists.\n" +
        "  Create one with:  npm run admin:create -- your-email@example.com"
    );
  }

  console.log(`\nExporting ${city} trips from ${url}`);
  console.log(`  authenticating as ${admin.cityflowId} (admin)\n`);

  const token = await mintToken(admin);

  const baseline = await download(url, token, city, "BASELINE");
  console.log(`  ✔ ${baseline.path}`);
  console.log(`    ${baseline.trips} trips`);

  const cityflow = await download(url, token, city, "CITYFLOW");
  console.log(`  ✔ ${cityflow.path}`);
  console.log(`    ${cityflow.trips} trips`);

  console.log();

  /*
    Two checks worth making here rather than ten minutes into a simulation.
  */
  if (baseline.trips !== cityflow.trips) {
    console.log("  ⚠ The two files hold DIFFERENT numbers of trips.");
    console.log("    They should be identical — same travellers, same journeys.");
    console.log("    Something is wrong; do not trust a comparison built on these.\n");
  } else if (baseline.trips === 0) {
    console.log(`  ⚠ No trips at all for ${city}.`);
    console.log("    Either nobody's routine includes today, or the city is empty.");
    console.log(`    Try:  npm run demo:seed -- --city ${city} --users 600\n`);
  } else {
    console.log(`  Both files hold the same ${baseline.trips} trips.`);
    console.log("  Same travellers, same origins and destinations.");
    console.log("  Only the departure times differ — which is the experiment.\n");
    console.log("  NEXT:");
    console.log("    cd scripts/sumo");
    console.log("    ./run-comparison.sh city.osm.xml baseline.trips.xml cityflow.trips.xml\n");
  }
}

main()
  .catch((error) => {
    console.error(`\n✖ ${error.message}\n`);
    if (String(error.message).includes("fetch failed")) {
      console.error("  Is the dev server running?  npm run dev");
      console.error("  If it is on a different port, pass  --url http://localhost:3001\n");
    }
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
