import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create your account",
  description:
    "Create a CityFlow AI account and receive an anonymous CityFlow ID for personalised departure recommendations.",
};

/**
 * Sign-up page.
 * The middleware sends already-signed-in visitors to /dashboard instead.
 */
export default function SignupPage() {
  return (
    <AuthShell
      title="Create your CityFlow account"
      subtitle="It takes about a minute. You will get an anonymous CityFlow ID straight away."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary underline">
            Log in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
