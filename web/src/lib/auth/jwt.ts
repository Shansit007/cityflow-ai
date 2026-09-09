import { SignJWT, jwtVerify } from "jose";

import { getAuthSecret } from "@/lib/env";

/**
 * Signed session tokens.
 *
 * We use `jose` (not `jsonwebtoken`) because it works in BOTH runtimes Next.js
 * uses: the Node.js runtime for API routes and the Edge runtime for middleware.
 */

/** What we store inside the login cookie. Deliberately tiny — no personal data. */
export interface SessionPayload {
  /** Internal user id (database primary key). */
  userId: string;
  /** Anonymous public ID, e.g. "CF-8X42K91". */
  cityflowId: string;
  /** "USER" for commuters, "ADMIN" for the Admin Portal (Phase 4). */
  role: "USER" | "ADMIN";
}

/** How long a login lasts before the user has to sign in again. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

const ALGORITHM = "HS256";

/** Creates a signed session token. */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);

  return new SignJWT({
    cityflowId: payload.cityflowId,
    role: payload.role,
  })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(payload.userId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_MAX_AGE_SECONDS)
    .sign(getAuthSecret());
}

/**
 * Verifies a session token.
 * Returns null for anything invalid: bad signature, expired, tampered, missing.
 * Callers should treat null as "not logged in" — never as an error to show.
 */
export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getAuthSecret(), {
      algorithms: [ALGORITHM],
    });

    const userId = payload.sub;
    const cityflowId = payload.cityflowId;

    if (typeof userId !== "string" || typeof cityflowId !== "string") {
      return null;
    }

    // Written this way (rather than a `!==` check) so TypeScript can be certain
    // the value really is one of the two allowed roles.
    const role: SessionPayload["role"] | null =
      payload.role === "ADMIN" ? "ADMIN" : payload.role === "USER" ? "USER" : null;

    if (role === null) return null;

    return { userId, cityflowId, role };
  } catch {
    return null;
  }
}
