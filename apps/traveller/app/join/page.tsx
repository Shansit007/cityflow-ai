import { redirect } from "next/navigation";
import { AppShell } from "@cityflow/ui";

import { CityIdForm } from "@/components/city-id-form";
import { cityByCode, DEFAULT_CITY } from "@/lib/cities";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  if (await readSession()) redirect("/today");

  const requested = (await searchParams).city ?? DEFAULT_CITY;
  const city = cityByCode(requested) ?? cityByCode(DEFAULT_CITY)!;

  return (
    <AppShell productName="CityFlow AI">
      <div className="max-w-xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          Your City ID for {city.name}
        </h1>
        <p className="mt-4 text-sm text-[var(--ink-muted)]">
          This is the whole account. It is generated in your browser, and the only things
          that reach the server are the ID itself and a one-way hash of the recovery
          phrase. There is no name, email, phone number or device identifier in the
          database, and no column to put one in.
        </p>
        <p className="mt-3 text-sm text-[var(--ink-muted)]">
          The consequence is that nobody can give the account back to you. Lose the
          recovery phrase and it is gone.
        </p>

        <CityIdForm cityCode={city.code} />
      </div>
    </AppShell>
  );
}
