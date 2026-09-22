import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";
import { verifySessionToken } from "@/lib/auth/jwt";

/**
 * Route protection.
 *
 * This runs BEFORE a page renders, which makes it the cheapest place to answer
 * one question: "is this person allowed here?".
 *
 * NAMING NOTE
 * In Next.js 15 this file was called `middleware.ts` and exported `middleware`.
 * Next.js 16 renamed the convention to `proxy.ts` / `proxy` to make the network
 * boundary clearer. Same job, new name.
 *
 * It deliberately only checks the SIGNATURE of the session cookie and never
 * touches the database. Every request passes through here, so it has to stay
 * fast; the full user record is loaded later, in the page itself.
 */

/** Pages that require a signed-in commuter. */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/welcome",
  "/profile",
  "/onboarding",
  "/assistant",
  "/roads",
  "/participation",
  "/journeys",
  "/plan",
  "/insights",
  "/settings",
];

/** Pages that a signed-in user should not see again (they would be confusing). */
const AUTH_ONLY_PREFIXES = ["/login", "/signup"];

/**
 * The Admin Portal. Separate from the commuter portal in every sense: its own
 * route prefix, its own layout, and its own role.
 *
 * This is the fast edge check, using the role inside the signed cookie. Every
 * admin page and API route ALSO re-checks the role against the database — see
 * lib/auth/admin.ts for why both exist.
 */
const ADMIN_PREFIXES = ["/admin"];

/**
 * The Municipal Dashboard. A third portal with a third role.
 *
 * A MUNICIPAL user sees road issues, employees and repair work — and nothing
 * else. No commuter data, no demand analytics, no recommendations. That
 * separation is the point: the people who fix roads have no business reading
 * anybody's travel patterns, and the system should make that impossible rather
 * than merely discouraged.
 *
 * ADMIN is allowed through as well, because somebody has to be able to set the
 * portal up and add the first employees before any municipal account exists.
 */
const MUNICIPAL_PREFIXES = ["/municipal"];

/**
 * Three dedicated Vercel deployments (commuter / municipal / admin) run this
 * exact same app from the same database, each restricted at the edge to its
 * own audience's routes — one URL per audience, without maintaining three
 * separate codebases. Set by CITYFLOW_PORTAL in that deployment's Vercel
 * Environment Variables; a single combined deployment (and local dev, and
 * Docker Compose) simply never sets it, so this is a no-op there and the app
 * behaves exactly as it always has.
 */
type PortalMode = "commuter" | "admin" | "municipal";

function getPortalMode(): PortalMode | null {
  const raw = process.env.CITYFLOW_PORTAL;
  if (raw === "commuter" || raw === "admin" || raw === "municipal") {
    return raw;
  }
  return null;
}

/** The one prefix each dedicated (non-commuter) portal deployment owns. */
const DEDICATED_PORTAL_PREFIX: Record<"admin" | "municipal", string> = {
  admin: "/admin",
  municipal: "/municipal",
};

/** Where a visitor who is in the wrong place on a dedicated deployment belongs. */
const PORTAL_HOME: Record<PortalMode, string> = {
  commuter: "/dashboard",
  admin: "/admin",
  municipal: "/municipal",
};

/** Every dedicated deployment still needs to be able to sign in and recover an account. */
const SHARED_AUTH_PREFIXES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

function startsWithAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);
  const isSignedIn = session !== null;

  // 0. Dedicated single-portal deployment: anything outside this
  //    deployment's own audience does not exist here. This runs before every
  //    other rule and is a no-op (portalMode === null) on the combined
  //    deployment, local dev, and Docker Compose.
  const portalMode = getPortalMode();
  if (portalMode) {
    const isSharedAuthPath = startsWithAny(pathname, SHARED_AUTH_PREFIXES);
    const belongsToThisDeployment =
      portalMode === "commuter"
        ? !startsWithAny(pathname, ["/admin", "/municipal"])
        : startsWithAny(pathname, [DEDICATED_PORTAL_PREFIX[portalMode]]);

    if (!belongsToThisDeployment && !isSharedAuthPath) {
      if (!isSignedIn) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("next", PORTAL_HOME[portalMode]);
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.redirect(new URL(PORTAL_HOME[portalMode], request.url));
    }
  }

  // 1. Not signed in, opening a protected page -> go to login, remembering
  //    where they were trying to get to.
  if (!isSignedIn && startsWithAny(pathname, PROTECTED_PREFIXES)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Already signed in, opening login/signup -> send them to the dashboard.
  if (isSignedIn && startsWithAny(pathname, AUTH_ONLY_PREFIXES)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // 3. The Admin Portal. This is the fast edge check on the role carried in the
  //    signed cookie; lib/auth/admin.ts re-checks against the database inside
  //    every admin page and API route.
  if (startsWithAny(pathname, ADMIN_PREFIXES)) {
    if (!isSignedIn) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(loginUrl);
    }

    if (session.role !== "ADMIN") {
      // Not an error page: a commuter who lands here has done nothing wrong and
      // should simply end up where they belong.
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // 4. The Municipal Dashboard, same two-layer pattern as the Admin Portal.
  if (startsWithAny(pathname, MUNICIPAL_PREFIXES)) {
    if (!isSignedIn) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(loginUrl);
    }

    if (session.role !== "MUNICIPAL" && session.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

/**
 * Which requests this runs on: everything except Next.js internals, the API
 * routes (they check the session themselves) and static files.
 */
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
