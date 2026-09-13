export interface EngineHealth {
  status: "ok" | "degraded";
  version: string;
  database: "up" | "down";
}

export interface EngineClient {
  health(): Promise<EngineHealth>;
}

export class EngineUnavailableError extends Error {
  constructor(cause: unknown) {
    super("The CityFlow engine did not respond.");
    this.name = "EngineUnavailableError";
    this.cause = cause;
  }
}

/**
 * The engine runs on a free tier that sleeps when idle, so a cold request can
 * take several seconds. The timeout is generous enough to let one through and
 * short enough that a page render never hangs on it.
 */
const DEFAULT_TIMEOUT_MS = 8_000;

export function createEngineClient(
  baseUrl: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): EngineClient {
  const root = baseUrl.replace(/\/+$/, "");

  async function get<T>(path: string): Promise<T> {
    try {
      const response = await fetch(`${root}${path}`, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: "application/json" },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`${path} returned ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (cause) {
      throw new EngineUnavailableError(cause);
    }
  }

  return {
    health: () => get<EngineHealth>("/health"),
  };
}
