"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useCity } from "@/components/city/city-provider";
import { Button } from "@/components/ui/button";
import { Notice, TextField } from "@/components/ui/input";
import { signupSchema, fieldErrorsFrom } from "@/lib/validation";

/**
 * Sign-up form.
 *
 * Validates on the client first (instant feedback), then again on the server
 * (the only validation that actually protects the database).
 */
export function SignupForm() {
  const router = useRouter();
  const { cityCode } = useCity();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    // --- 1. Client-side check ------------------------------------------
    const parsed = signupSchema.safeParse({ email, password, displayName, cityCode });

    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    // --- 2. Ask the server ---------------------------------------------
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const data = await response.json();

      if (!response.ok) {
        setFormError(data.error ?? "Something went wrong. Please try again.");
        if (data.fieldErrors) setFieldErrors(data.fieldErrors);
        return;
      }

      // --- 3. Show the new CityFlow ID ---------------------------------
      router.push("/welcome");
      router.refresh();
    } catch {
      setFormError(
        "Could not reach the server. Please check your internet connection and try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError && <Notice tone="error">{formError}</Notice>}

      <TextField
        label="Email address"
        type="email"
        name="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fieldErrors.email}
        hint="Used for signing in and account recovery only."
        placeholder="you@example.com"
      />

      <TextField
        label="Name or nickname"
        type="text"
        name="displayName"
        autoComplete="nickname"
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
        error={fieldErrors.displayName}
        hint="Optional. Only used to greet you on your dashboard."
        placeholder="Optional"
      />

      <TextField
        label="Password"
        type={showPassword ? "text" : "password"}
        name="password"
        autoComplete="new-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={fieldErrors.password}
        hint="At least 8 characters, including a letter and a number."
        trailing={
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            className="mr-1 rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-surface-2"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        }
      />

      <Button type="submit" fullWidth size="lg" loading={submitting}>
        Create my CityFlow account
      </Button>

      <p className="text-xs leading-relaxed text-subtle">
        By creating an account you agree that CityFlow AI may store the travel routine and
        preferences you provide, linked to an anonymous CityFlow ID, in order to generate
        departure recommendations. You can edit or delete this information later.
      </p>
    </form>
  );
}
