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
   * Build a self-contained server for the Docker image — but only for the
   * Docker image.
   *
   * `standalone` emits `.next/standalone/server.js` together with only the
   * node_modules the application actually imports, which takes the runtime
   * image from roughly 1.2 GB to about 250 MB.
   *
   * On Vercel, this setting actively breaks the build rather than being
   * ignored: it moves Next.js's file-tracing manifests under
   * `.next/standalone/` instead of the top level, and Vercel's own packaging
   * step looks for `.next/next-server.js.nft.json` at the top level —
   * doesn't find it — and fails with `ENOENT: .../next-server.js.nft.json`
   * right after the build otherwise succeeds. Vercel has its own equivalent
   * output tracing built in and does not need this flag at all, so it is
   * only applied when NOT building on Vercel, detected via the `VERCEL`
   * environment variable Vercel sets automatically on every build.
   */
  output: process.env.VERCEL ? undefined : "standalone",

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
