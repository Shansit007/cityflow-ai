import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import { authSecret } from "./env";

export const SESSION_COOKIE = "cityflow_session";

/** No password to re-enter, and recovery is deliberately awkward, so sessions are long. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

const ALGORITHM = "HS256";

export interface Session {
  identityId: string;
  cityId: string;
}

export async function issueSession(session: Session): Promise<void> {
  const issuedAt = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({ cityId: session.cityId })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(session.identityId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + MAX_AGE_SECONDS)
    .sign(authSecret());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function readSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, authSecret(), { algorithms: [ALGORITHM] });
    const identityId = payload.sub;
    const cityId = payload.cityId;

    if (typeof identityId !== "string" || typeof cityId !== "string") return null;
    return { identityId, cityId };
  } catch {
    // Tampered, expired or signed with a rotated secret. All of these mean "logged
    // out", never an error worth showing a traveller.
    return null;
  }
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
