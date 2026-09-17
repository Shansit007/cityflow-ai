import { join } from "node:path";
import type { NextConfig } from "next";

// Next reads .env files from the app directory, but DATABASE_URL and AUTH_SECRET are
// the same for both apps and belong in one place. Loading the workspace root file here
// means a clean clone needs one `cp .env.example .env`, not one per app.
//
// Precedence: a variable already in the shell environment wins, which is how CI and the
// host platforms supply theirs. This runs before Next reads the app's own .env files,
// though, so the root .env wins over a local one rather than the other way round. Keep
// per-app overrides out of this repo and the surprise never comes up.
try {
  process.loadEnvFile(join(process.cwd(), "..", "..", ".env"));
} catch {
  // No root .env. The environment is expected to carry the variables already, and
  // lib/env.ts fails loudly on the first request if it does not.
}

const config: NextConfig = {
  transpilePackages: ["@cityflow/ui", "@cityflow/api-client", "@cityflow/secrets"],
};

export default config;
