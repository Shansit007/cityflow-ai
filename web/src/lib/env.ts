/**
 * Environment variable access, in one place.
 *
 * Reading `process.env` directly all over the codebase makes it very easy to
 * ship a build where a secret is silently missing. Everything goes through
 * here instead, so a missing value fails loudly with a readable message.
 */

/** Reads a required server-side environment variable. */
function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value || value.trim().length === 0) {
    throw new Error(
      `Missing environment variable "${name}".\n` +
        `Add it to web/.env (locally) or to your Vercel project settings (in production).\n` +
        `See web/.env.example for the expected format.`
    );
  }

  return value;
}

/** Postgres connection string (Neon). */
export function getDatabaseUrl(): string {
  return requireEnv("DATABASE_URL");
}

/**
 * Secret used to sign the login cookie.
 * Must be at least 32 characters so the HS256 signature is not trivially guessable.
 */
export function getAuthSecret(): Uint8Array {
  const secret = requireEnv("AUTH_SECRET");

  if (secret.length < 32) {
    throw new Error(
      'AUTH_SECRET must be at least 32 characters long. Generate one with: openssl rand -base64 48'
    );
  }

  return new TextEncoder().encode(secret);
}

/** Public base URL of the app. Safe to expose to the browser. */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** True when running `next dev`. */
export const IS_DEV = process.env.NODE_ENV !== "production";
