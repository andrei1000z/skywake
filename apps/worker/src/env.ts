export interface RateLimiter {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

export interface GateNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(input: string | Request, init?: RequestInit): Promise<Response> };
}

export interface Env {
  GATE: GateNamespace;
  IP_LIMITER?: RateLimiter;
  /** Comma-separated exact origins allowed to call the API from browsers. */
  ALLOWED_ORIGINS?: string;
  UPSTREAM_RPS?: string;
  UPSTREAM_BURST?: string;
  UPSTREAM_PER_MIN?: string;
  UPSTREAM_PER_DAY?: string;
  USER_AGENT?: string;
  VERSION?: string;
}
