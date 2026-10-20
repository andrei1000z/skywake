/** How a position was obtained. Mirrors readsb's `type` field, collapsed to what users care about. */
export type PositionSource = 'adsb' | 'mlat' | 'tisb' | 'adsr' | 'modes' | 'other';

/**
 * Provider-independent aircraft state. Units are the aviation-native ones used upstream:
 * feet, knots, feet/minute, degrees true. The UI converts for display.
 */
export interface Aircraft {
  /** ICAO 24-bit address, lowercase hex. `~` prefix = non-ICAO (TIS-B) address. */
  hex: string;
  callsign?: string;
  reg?: string;
  /** ICAO type designator, e.g. "A20N". */
  type?: string;
  /** ADS-B emitter category, e.g. "A3". */
  cat?: string;
  lat: number;
  lon: number;
  /** Barometric altitude in feet. Absent when unknown. */
  alt?: number;
  onGround: boolean;
  altGeom?: number;
  /** Ground speed, knots. */
  gs?: number;
  /** Track over ground, degrees true. */
  track?: number;
  /** Vertical rate, feet/minute. */
  vr?: number;
  squawk?: string;
  /** readsb emergency field when not "none". */
  emergency?: string;
  src: PositionSource;
  /** Epoch ms when the position was last received by the network. */
  posTs: number;
  /** Provider id that supplied this record. */
  provider: string;
  /** Military flag from upstream database, when present. */
  mil?: boolean;
}

/** Any endpoint returning aircraft. */
export interface AircraftListResponse {
  /** Epoch ms at which the upstream snapshot was taken. */
  ts: number;
  /** True when served from cache past its freshness window (upstream unavailable or throttled). */
  stale: boolean;
  provider: string;
  aircraft: Aircraft[];
}

/** Response for one grid cell. */
export interface CellResponse extends AircraftListResponse {
  cell: string;
}

export interface RouteResponse {
  stale: boolean;
  route: RouteInfo | null;
}

export interface ProviderHealth {
  provider: string;
  ok: boolean;
  lastSuccess: number | null;
  lastError: string | null;
  lastErrorAt: number | null;
  /** Upstream requests made in the last 60 seconds by the gate. */
  requestsLastMinute: number;
  backoffUntil: number | null;
}

export interface HealthResponse {
  service: 'skywake-api';
  version: string;
  now: number;
  providers: ProviderHealth[];
}

export interface RouteInfo {
  callsign: string;
  /** ICAO airport codes in order, origin first. */
  airports: { icao: string; iata?: string; name?: string; city?: string; country?: string; lat?: number; lon?: number }[];
  /** Upstream judged the route consistent with the current position. */
  plausible: boolean;
  provider: string;
}

/** Latest airport weather observation (NOAA Aviation Weather Center, public domain). */
export interface Metar {
  icao: string;
  /** Observation time, epoch ms. */
  obsTime: number;
  raw: string;
  tempC?: number;
  dewpointC?: number;
  /** Degrees true; undefined when variable. */
  windDir?: number;
  windKt?: number;
  gustKt?: number;
  /** Statute miles; "6+" upstream becomes 6 with visibilityPlus. */
  visibilitySm?: number;
  visibilityPlus?: boolean;
  qnhHpa?: number;
  /** VFR, MVFR, IFR or LIFR. */
  category?: string;
  clouds: { cover: string; baseFt?: number }[];
}

export interface MetarResponse {
  stale: boolean;
  metar: Metar | null;
}

export interface ApiError {
  error: string;
  retryAfter?: number;
}
