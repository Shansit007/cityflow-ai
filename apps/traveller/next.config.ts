import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@cityflow/ui", "@cityflow/api-client", "@cityflow/secrets"],
};

export default config;
