# Sustainability and capacity

Skywake depends on volunteer infrastructure (ADSB.lol, OpenFreeMap) and on free tiers (Cloudflare, GitHub).
That only works as long as Skywake behaves well toward them.

## Upstream budget

- By default Skywake makes 0.75 requests per second, with bursts of up to 3 and a cap of 40 per minute. ADSB.lol publishes per-IP limits of 4 per second and 60 per minute. The margin matters because Cloudflare Workers reach the internet through shared egress IPs, so other services may count against the same per-IP limit. When ADSB.lol answers 429, the gate honours `Retry-After`, backs off exponentially and serves cached positions marked as stale.
- The web client paces itself to that budget: each cell in view is refreshed about every `cells × 1.6 s` (at least 8 s), cells with the oldest data are fetched first, and the "delayed" banner only appears when data is genuinely older than that schedule allows.
- Thanks to the shared cache and the fixed grid, cost does not grow with the number of users. It grows with the number of *distinct regions* being watched. About 5 cells can be kept fully fresh (8 s refresh) at once. Other regions refresh more slowly, and the UI shows how old the data is.
- **Before any promotion** (press, app stores, social media), the maintainer will contact ADSB.lol to agree on capacity and attribution. Any agreement reached will be recorded here.

## Running costs

| Service | Plan | Expected cost |
|---|---|---|
| Cloudflare Workers + Durable Objects | Free (100k requests/day) | €0 at small scale. The edge cache stops most requests before they reach the Durable Object. |
| GitHub Pages + Actions | Free for public repos | €0 |
| OpenFreeMap tiles | Free public instance | €0. Consider [donating](https://openfreemap.org) if usage grows. |

## What we will not do

- Sell data, show ads or add trackers.
- Get around provider limits by using several IPs or keys.
- Hide limitations from users.
