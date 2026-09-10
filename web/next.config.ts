import type { NextConfig } from "next";

/**
 * Next.js configuration for CityFlow AI.
 *
 * Kept intentionally small. Anything environment-specific belongs in `.env`
 * (locally) or in the Vercel project settings (in production).
 */
const nextConfig: NextConfig = {
  // Surface React problems early during development.
  reactStrictMode: true,

  /**
   * Keep the Prisma client OUT of the bundler.
   *
   * Prisma generates a fresh client into node_modules every time the schema
   * changes. If the bundler inlines a copy of it, that copy can go stale — you
   * then get "Cannot read properties of undefined (reading 'findMany')" for a
   * model that demonstrably exists, because the running code is holding an
   * older build of the client.
   *
   * Listing it here makes the server require it at runtime instead, so it is
   * always the client that was generated most recently.
   */
  serverExternalPackages: ["@prisma/client", ".prisma/client"],

  // We fail the production build on type errors on purpose — a broken type is a
  // real bug, not a warning.
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
