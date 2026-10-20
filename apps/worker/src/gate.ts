import { DurableObject } from 'cloudflare:workers';
import { GateCore } from './gate-core.js';
import { gateOp } from './gate-ops.js';
import type { Env } from './env.js';

/**
 * One global instance ("global") serialises every upstream call in the deployment,
 * so rate limits hold no matter how many edge locations or users are active.
 */
export class UpstreamGate extends DurableObject<Env> {
  private core: GateCore;
  private weather: GateCore;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const n = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);
    this.core = new GateCore(
      {
        rps: n(env.UPSTREAM_RPS, 0.75),
        burst: n(env.UPSTREAM_BURST, 3),
        perMinute: n(env.UPSTREAM_PER_MIN, 40),
        perDay: n(env.UPSTREAM_PER_DAY, 0),
      },
      fetch.bind(globalThis),
      Date.now,
      env.USER_AGENT || undefined,
    );
    // aviationweather.gov allows 100 req/min; METARs are cached 10 min, so a fifth of that is plenty.
    this.weather = new GateCore({ rps: 0.5, burst: 3, perMinute: 20, perDay: 0 }, fetch.bind(globalThis), Date.now, env.USER_AGENT || undefined);
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    return gateOp(this.core, url.pathname.slice(1), url.searchParams, this.weather);
  }
}
