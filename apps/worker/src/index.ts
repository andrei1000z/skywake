import type { Env } from './env.js';
import { handle } from './router.js';

export { UpstreamGate } from './gate.js';

declare const caches: { default: import('./router.js').CacheLike };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await handle(request, env, ctx, caches.default);
    } catch {
      // Never leak stack traces or upstream details to clients.
      return new Response('{"error":"internal"}', { status: 500, headers: { 'content-type': 'application/json' } });
    }
  },
};
