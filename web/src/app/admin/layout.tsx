import type { Metadata } from "next";
import type { ReactNode } from "react";

import { requireAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: {
    default: "Admin Portal · CityFlow AI",
    template: "%s · Admin Portal",
  },
  description:
    "CityFlow AI Admin Portal — city-level demand monitoring, optimisation status and reporting.",
  // An internal operations tool has no business in search results.
  robots: { index: false, follow: false },
};

/**
 * Admin Portal layout.
 *
 * Its only job is the guard. `proxy.ts` already blocked non-admins at the edge
 * using the role in their session cookie; this re-checks against the database,
 * because a cookie is a snapshot and rights can be revoked after it was issued.
 *
 * Because this runs for every page under /admin, no individual admin page has
 * to remember to check.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();

  return <>{children}</>;
}
