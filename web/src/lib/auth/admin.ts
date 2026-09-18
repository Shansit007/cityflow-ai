import { redirect } from "next/navigation";

import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";

/**
 * Admin Portal access.
 *
 * TWO LAYERS, ON PURPOSE
 *  1. `proxy.ts` blocks /admin at the edge using the role inside the signed
 *     session cookie. That is fast and keeps non-admins off the route entirely.
 *  2. This helper re-checks the role against the DATABASE inside every admin
 *     page and API route.
 *
 * The second check is not redundant. The role in the cookie is a snapshot from
 * when the person signed in — if their admin rights were revoked an hour ago,
 * their cookie still claims otherwise until it expires. The database is the
 * authority, so anything that actually reads city data asks the database.
 *
 * NOTE ON THE OTHER DIRECTION: someone newly promoted to admin must sign out
 * and back in before the edge check lets them through. That is the safe way
 * round, and `npm run admin:create` says so.
 */

/** Returns the signed-in admin, or redirects away. Never returns for a non-admin. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) redirect("/login?next=/admin");

  // A signed-in commuter who reaches an admin URL is sent to their own
  // dashboard rather than shown an error — there is nothing here for them.
  if (user.role !== "ADMIN") redirect("/dashboard");

  return user;
}

/**
 * The API-route version: returns the admin, or null.
 * Callers turn null into a 403 themselves, since API routes must not redirect.
 */
export async function getAdminOrNull(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}
