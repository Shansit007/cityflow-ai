import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to CityFlow AI to see your departure-time recommendation.",
};

/**
 * Log-in page.
 *
 * `searchParams` is a Promise in Next.js 15, so it has to be awaited before the
 * `?next=` value can be read.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;

  // Only internal paths are accepted, never a full URL to another site.
  const nextPath =
    params.next && params.next.startsWith("/") ? params.next : "/dashboard";

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to see today's departure recommendation for your routine."
      footer={
        <>
          New to CityFlow AI?{" "}
          <Link href="/signup" className="font-medium text-primary underline">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm nextPath={nextPath} />
    </AuthShell>
  );
}
