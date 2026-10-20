/**
 * Aircraft photos from the Planespotters.net public photo API.
 *
 * Terms (planespotters.net/photo/api): called from the browser (it checks Origin/Referer),
 * the photographer is credited next to the image, and the image links to the photo page with a plain
 * anchor (no rel="nofollow"). It is free for everyone in Skywake. One request per opened aircraft panel,
 * remembered for the session, so the API is never polled.
 */

export interface Photo {
  src: string;
  width: number;
  height: number;
  link: string;
  photographer: string;
}

const cache = new Map<string, Photo | null>();
const HEX_RE = /^[0-9a-f]{6}$/;

function isSafeUrl(u: unknown, hosts: RegExp): u is string {
  if (typeof u !== 'string') return false;
  try {
    const url = new URL(u);
    return url.protocol === 'https:' && hosts.test(url.hostname);
  } catch {
    return false;
  }
}

export function parsePhotos(body: unknown): Photo | null {
  const list = (body as { photos?: unknown })?.photos;
  if (!Array.isArray(list)) return null;
  for (const p of list as Record<string, unknown>[]) {
    const img = (p.thumbnail_large ?? p.thumbnail) as { src?: unknown; size?: { width?: unknown; height?: unknown } } | undefined;
    if (!img || !isSafeUrl(img.src, /(^|\.)plnspttrs\.net$/) || !isSafeUrl(p.link, /(^|\.)planespotters\.net$/)) continue;
    if (typeof p.photographer !== 'string' || !p.photographer.trim()) continue;
    const w = Number(img.size?.width);
    const h = Number(img.size?.height);
    return {
      src: img.src,
      width: Number.isFinite(w) && w > 0 ? w : 4,
      height: Number.isFinite(h) && h > 0 ? h : 3,
      link: p.link,
      photographer: p.photographer.trim().slice(0, 80),
    };
  }
  return null;
}

/** Resolves to null when there is no photo or the service is unavailable; never throws. */
export async function photoFor(hex: string, signal?: AbortSignal): Promise<Photo | null> {
  const key = hex.toLowerCase();
  if (!HEX_RE.test(key)) return null;
  if (cache.has(key)) return cache.get(key)!;
  try {
    const res = await fetch(`https://api.planespotters.net/pub/photos/hex/${key}`, { signal });
    const photo = res.ok ? parsePhotos(await res.json()) : null;
    // Only remember definite answers; a transient failure may succeed next time the panel opens.
    if (res.ok) cache.set(key, photo);
    return photo;
  } catch {
    return null;
  }
}
