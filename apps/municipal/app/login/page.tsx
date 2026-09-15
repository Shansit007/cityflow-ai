import { redirect } from "next/navigation";
import { AppShell, Card } from "@cityflow/ui";

import { LoginForm } from "@/components/login-form";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await readSession()) redirect("/");

  return (
    <AppShell productName="CityFlow AI" surface="Municipal">
      <div className="mx-auto max-w-sm">
        <h1 className="text-xl font-semibold tracking-tight">Staff sign in</h1>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          Named accounts, because everything done here is on behalf of the council and has
          to be attributable. Traveller accounts work the opposite way.
        </p>

        <Card className="mt-6">
          <LoginForm />
        </Card>
      </div>
    </AppShell>
  );
}
