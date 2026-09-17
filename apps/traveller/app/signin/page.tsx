import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@cityflow/ui";

import { SignInForm } from "@/components/sign-in-form";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const session = await readSession();
  if (session) redirect("/today");

  return (
    <AppShell
      productName="CityFlow AI"
      nav={
        <Link href="/" className="text-[var(--ink-muted)] hover:text-[var(--ink)]">
          Home
        </Link>
      }
    >
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>

      <p className="mt-3 max-w-md text-sm text-[var(--ink-muted)]">
        Your City ID and the recovery phrase you were shown when you created it. There is
        no email to reset and no support desk that can look you up: the phrase is the
        account.
      </p>

      <SignInForm />

      <p className="mt-10 max-w-md text-sm text-[var(--ink-muted)]">
        Lost the phrase? Nothing can be recovered — the server only ever stored a one-way
        hash of it. You can{" "}
        <Link href="/" className="text-[var(--accent)]">
          start a new City ID
        </Link>
        , but the routines attached to the old one stay unreachable.
      </p>
    </AppShell>
  );
}
