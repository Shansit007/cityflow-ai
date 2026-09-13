import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@cityflow/ui", "@cityflow/api-client"],
};

export default config;
