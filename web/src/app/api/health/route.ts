import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

/**
 * GET /api/health
 *
 * A simple status endpoint used during development and, from Phase 4, by the
 * Admin Portal "System health" panel.
 *
 * Open http://localhost:3000/api/health in your browser to check that the app
 * can actually reach the database.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // never cache a health check

export async function GET() {
  const startedAt = Date.now();

  try {
    // The cheapest possible query that still proves the connection works.
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "ok",
      database: "connected",
      responseTimeMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[health] database check failed:", error);

    return NextResponse.json(
      {
        status: "degraded",
        database: "unreachable",
        hint: "Check DATABASE_URL in web/.env.local and that your Neon project is active.",
        checkedAt: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
