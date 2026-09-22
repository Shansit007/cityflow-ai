import type { Metadata } from "next";

import { Container } from "@/components/ui/container";
import { MunicipalAccessManager } from "@/components/admin/municipal-access-manager";
import { loadMunicipalOfficers } from "@/lib/admin/municipal-access";
import { CITIES } from "@/lib/cities";

export const metadata: Metadata = { title: "Municipal access" };

/**
 * Admin Portal -- grant or revoke Municipal Dashboard access.
 *
 * Every city has its own municipal officer(s); this is where the admin
 * assigns them, one existing account at a time, without a terminal. See
 * lib/admin/municipal-access.ts for the full reasoning, including why this
 * screen can never grant or touch Admin access.
 */
export default async function AdminMunicipalAccessPage() {
  const officers = await loadMunicipalOfficers();

  return (
    <section className="py-8">
      <Container width="wide">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            Municipal access
          </h1>
          <p className="mt-2 text-sm text-muted">
            {officers.length} account{officers.length === 1 ? "" : "s"} with municipal access,
            across every city
          </p>
        </div>

        <div className="mt-6">
          <MunicipalAccessManager initialOfficers={officers} cities={CITIES} />
        </div>
      </Container>
    </section>
  );
}
