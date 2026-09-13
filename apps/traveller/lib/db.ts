import { Pool } from "pg";

import { databaseUrl } from "./env";

// Next reloads modules on every edit in development, so the pool is parked on
// globalThis to stop each reload leaking another set of connections.
const globalForPool = globalThis as typeof globalThis & { cityflowPool?: Pool };

export function pool(): Pool {
  if (!globalForPool.cityflowPool) {
    globalForPool.cityflowPool = new Pool({ connectionString: databaseUrl(), max: 5 });
  }
  return globalForPool.cityflowPool;
}
