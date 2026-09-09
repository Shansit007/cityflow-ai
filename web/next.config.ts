import type { NextConfig } from "next";

/**
 * Next.js configuration for CityFlow AI.
 *
 * Kept intentionally small. Anything environment-specific belongs in `.env.local`
 * (locally) or in the Vercel project settings (in production).
 */
const nextConfig: NextConfig = {
  // Surface React problems early during development.
  reactStrictMode: true,

  // We fail the production build on type errors on purpose — a broken type is a
  // real bug, not a warning.
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
