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

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const n = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);
    this.core = new GateCore(
      {
        rps: n(env.UPSTREAM_RPS, 1),
        burst: n(env.UPSTREAM_BURST, 3),
        perMinute: n(env.UPSTREAM_PER_MIN, 50),
        perDay: n(env.UPSTREAM_PER_DAY, 0),
      },
      fetch.bind(globalThis),
      Date.now,
      env.USER_AGENT || undefined,
    );
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    return gateOp(this.core, url.pathname.slice(1), url.searchParams);
  }
}
