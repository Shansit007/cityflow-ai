export interface EngineHealth {
  status: "ok" | "degraded";
  version: string;
  database: "up" | "down";
}

export interface RecommendationRequest {
  city: string;
  identity_id: string;
  routine_id?: string | null;
  origin_cell: string;
  destination_cell: string;
  /** ISO 8601 instant. The engine plans in UTC and the browser knows the offset. */
  arrive_by: string;
  arrive_window_minutes: number;
  mode: string;
}

export interface Recommendation {
  depart_at: string;
  naive_depart_at: string;
  usual_depart_at: string;
  travel_seconds: number;
  shift_minutes: number;
  /**
   * Excess over segment capacity this journey would add, at the recommended time and
   * at the usual one. The difference is what the recommendation is worth; it is not a
   * travel-time saving, which the engine cannot predict yet.
   */
  overflow_at_plan: number;
  overflow_at_usual: number;
  /** The same comparison as a count of roads, which is what the traveller is shown. */
  roads_over_at_plan: number;
  roads_over_at_usual: number;
  existing: boolean;
}

export interface EngineClient {
  health(): Promise<EngineHealth>;
  recommend(request: RecommendationRequest): Promise<Recommendation>;
}

export class EngineUnavailableError extends Error {
  constructor(cause: unknown) {
    super("The CityFlow engine did not respond.");
    this.name = "EngineUnavailableError";
    this.cause = cause;
  }
}

/**
 * The engine answered, and said no.
 *
 * Distinct from EngineUnavailableError on purpose: one means the service is down and
 * the other means it is up and rejected this request. Collapsing them sends whoever is
 * debugging to restart a process that was never stopped.
 */
export class EngineRefusedError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(`The engine refused the request (${status}): ${detail}`);
    this.name = "EngineRefusedError";
    this.status = status;
    this.detail = detail;
  }
}

async function refusal(path: string, response: Response): Promise<EngineRefusedError> {
  let detail = response.statusText;
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "detail" in body) {
      detail = String((body as { detail: unknown }).detail);
    }
  } catch {
    // A body that is not JSON tells us nothing the status has not already said.
  }
  return new EngineRefusedError(response.status, `${path}: ${detail}`);
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
        throw await refusal(path, response);
      }

      return (await response.json()) as T;
    } catch (cause) {
      if (cause instanceof EngineRefusedError) throw cause;
      throw new EngineUnavailableError(cause);
    }
  }

  async function post<T>(path: string, body: unknown): Promise<T> {
    try {
      const response = await fetch(`${root}${path}`, {
        method: "POST",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });

      if (!response.ok) {
        throw await refusal(path, response);
      }

      return (await response.json()) as T;
    } catch (cause) {
      if (cause instanceof EngineRefusedError) throw cause;
      throw new EngineUnavailableError(cause);
    }
  }

  return {
    health: () => get<EngineHealth>("/health"),
    recommend: (request) => post<Recommendation>("/recommendations", request),
  };
}
