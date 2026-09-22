import { prisma } from "@/lib/db";
import type { CityCode } from "@/lib/cities";
import { getCity } from "@/lib/cities";

/**
 * Admin-granted Municipal Dashboard access.
 *
 * WHY THIS EXISTS (rather than the terminal script it replaces)
 * Promoting an account to MUNICIPAL used to require someone with the database
 * credentials to run `npm run role:set -- email MUNICIPAL` from a terminal.
 * That is still the only way to grant ADMIN -- see scripts/set-role.mjs and its
 * comment on why elevated roles are never a sign-up checkbox -- but MUNICIPAL
 * officers are onboarded far more often, one per city, by someone who is
 * already the admin. This module is that same trusted action, moved from the
 * terminal into a real Admin Portal screen, without loosening who can grant
 * it: only a signed-in ADMIN can reach the route that calls these functions
 * (see /api/admin/municipal-access), and an ADMIN account itself can never be
 * touched by it.
 *
 * The account being granted access must already exist -- sign up normally
 * first, exactly as the old script required. This never creates an account.
 */

export class MunicipalAccessAccountNotFoundError extends Error {
  constructor(email: string) {
    super(
      `No account found for "${email}". They need to sign up on CityFlow AI first, then you can grant them municipal access.`
    );
    this.name = "MunicipalAccessAccountNotFoundError";
  }
}

export class MunicipalAccessAdminAccountError extends Error {
  constructor(email: string) {
    super(
      `"${email}" is an Admin account. Municipal access only applies to regular commuter accounts, and this screen never changes who holds Admin.`
    );
    this.name = "MunicipalAccessAdminAccountError";
  }
}

export interface MunicipalOfficer {
  id: string;
  email: string;
  cityflowId: string;
  cityCode: CityCode | null;
  cityName: string;
  createdAt: Date;
}

/** Every account currently holding MUNICIPAL access, across every city. */
export async function loadMunicipalOfficers(): Promise<MunicipalOfficer[]> {
  const rows = await prisma.user.findMany({
    where: { role: "MUNICIPAL" },
    select: { id: true, email: true, cityflowId: true, cityCode: true, createdAt: true },
    orderBy: [{ cityCode: "asc" }, { email: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    cityflowId: row.cityflowId,
    cityCode: (row.cityCode as CityCode | null) ?? null,
    cityName: row.cityCode ? getCity(row.cityCode).name : "No city set",
    createdAt: row.createdAt,
  }));
}

/**
 * Grants an existing account MUNICIPAL access for one city, or moves them to
 * a different city if they already had access somewhere else. Idempotent:
 * granting the same person the same city again is a no-op that still
 * succeeds.
 */
export async function grantMunicipalAccess(input: {
  email: string;
  cityCode: CityCode;
}): Promise<MunicipalOfficer> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, email: true, cityflowId: true, role: true, cityCode: true },
  });

  if (!user) throw new MunicipalAccessAccountNotFoundError(input.email);
  if (user.role === "ADMIN") throw new MunicipalAccessAdminAccountError(input.email);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: "MUNICIPAL", cityCode: input.cityCode },
    select: { id: true, email: true, cityflowId: true, cityCode: true, createdAt: true },
  });

  return {
    id: updated.id,
    email: updated.email,
    cityflowId: updated.cityflowId,
    cityCode: updated.cityCode as CityCode,
    cityName: getCity(updated.cityCode).name,
    createdAt: updated.createdAt,
  };
}

/**
 * Revokes municipal access, returning the account to a regular commuter
 * (USER). Their city preference is left as-is -- it means "which city they're
 * viewing", not "where they work", and clearing it would just make them
 * re-pick a city on their next visit for no real benefit.
 */
export async function revokeMunicipalAccess(email: string): Promise<{ email: string }> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  if (!user) throw new MunicipalAccessAccountNotFoundError(email);

  // Already not municipal (including "never was") -- nothing to do, but not an
  // error either: the end state the caller wanted is already true.
  if (user.role === "MUNICIPAL") {
    await prisma.user.update({ where: { id: user.id }, data: { role: "USER" } });
  }

  return { email };
}
