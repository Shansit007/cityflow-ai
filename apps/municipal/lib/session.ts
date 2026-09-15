import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import { authSecret } from "./env";

export const SESSION_COOKIE = "cityflow_staff";

/**
 * Eight hours: a shift. Staff sessions are deliberately far shorter than a traveller's
 * ninety days, because this account is named, can reassign other people's work, and is
 * used on shared machines in an office.
 */
const MAX_AGE_SECONDS = 60 * 60 * 8;

const ALGORITHM = "HS256";

export type Role = "head" | "employee";

export interface StaffSession {
  userId: string;
  city: string;
  role: Role;
  displayName: string;
}

export async function issueSession(session: StaffSession): Promise<void> {
  const issuedAt = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({
    city: session.city,
    role: session.role,
    displayName: session.displayName,
  })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(session.userId)
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

export async function readSession(): Promise<StaffSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, authSecret(), { algorithms: [ALGORITHM] });
    const { sub, city, role, displayName } = payload;

    if (typeof sub !== "string") return null;
    if (typeof city !== "string" || typeof displayName !== "string") return null;
    if (role !== "head" && role !== "employee") return null;

    return { userId: sub, city, role, displayName };
  } catch {
    // Tampered, expired or signed with a rotated secret. All of these mean "signed
    // out", and none of them is worth showing an error page for.
    return null;
  }
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
