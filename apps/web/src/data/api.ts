import type { AircraftListResponse, CellResponse, HealthResponse, MetarResponse, RouteResponse } from '@skywake/shared';

/** Skywake API base URL. Set VITE_API_BASE at build time; dev falls back to a local `wrangler dev`. */
export const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') || (import.meta.env.DEV ? 'http://localhost:8787' : '');

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public retryAfter?: number,
  ) {
    super(`${status} ${code}`);
  }
}

async function getJson<T>(path: string, signal?: AbortSignal, timeoutMs = 12_000): Promise<T> {
  // A production build without an API must say so, not silently call localhost on the visitor's machine.
  if (!API_BASE) throw new ApiError(0, 'api_not_configured');
  const timeout = AbortSignal.timeout(timeoutMs);
  const res = await fetch(API_BASE + path, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!res.ok) {
    let code = 'http_error';
    let retryAfter: number | undefined;
    try {
      const b = (await res.json()) as { error?: string; retryAfter?: number };
      code = b.error ?? code;
      retryAfter = b.retryAfter;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, code, retryAfter ?? (Number(res.headers.get('retry-after')) || undefined));
  }
  return (await res.json()) as T;
}

export const api = {
  cell: (id: string, signal?: AbortSignal) => getJson<CellResponse>(`/v1/cell/${id}`, signal),
  aircraft: (hex: string, signal?: AbortSignal) => getJson<AircraftListResponse>(`/v1/aircraft/${encodeURIComponent(hex)}`, signal),
  search: (q: string, signal?: AbortSignal) => getJson<AircraftListResponse>(`/v1/search?q=${encodeURIComponent(q)}`, signal),
  emergencies: (signal?: AbortSignal) => getJson<AircraftListResponse>('/v1/emergencies', signal),
  route: (callsign: string, signal?: AbortSignal) => getJson<RouteResponse>(`/v1/route/${encodeURIComponent(callsign)}`, signal),
  metar: (icao: string, signal?: AbortSignal) => getJson<MetarResponse>(`/v1/metar/${encodeURIComponent(icao)}`, signal),
  health: () => getJson<HealthResponse>('/v1/health'),
};
