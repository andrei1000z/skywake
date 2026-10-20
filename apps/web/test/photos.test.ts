import { describe, expect, it } from 'vitest';
import { parsePhotos } from '../src/data/photos';
import { fmtAge, fmtVisibility } from '../src/lib/units';

// Shape of a real api.planespotters.net/pub/photos/hex response (captured 2026-10-20).
const real = {
  photos: [{
    id: '1982059',
    thumbnail: { src: 'https://t.plnspttrs.net/36434/1982059_2d5d48e9d8_t.jpg', size: { width: 200, height: 131 } },
    thumbnail_large: { src: 'https://t.plnspttrs.net/36434/1982059_2d5d48e9d8_280.jpg', size: { width: 429, height: 280 } },
    link: 'https://www.planespotters.net/photo/1982059/hb-jcn-swiss-bombardier-cseries-cs300-bd-500-1a11?utm_source=api',
    photographer: 'Mehrad Watson',
  }],
};

describe('parsePhotos', () => {
  it('uses the large thumbnail and keeps credit + link', () => {
    expect(parsePhotos(real)).toEqual({
      src: real.photos[0]!.thumbnail_large.src, width: 429, height: 280, link: real.photos[0]!.link, photographer: 'Mehrad Watson',
    });
  });

  it('rejects images or links on foreign hosts and photos without a credit', () => {
    const bad = (patch: object) => parsePhotos({ photos: [{ ...real.photos[0], ...patch }] });
    expect(bad({ thumbnail_large: { src: 'https://evil.example/x.jpg' }, thumbnail: undefined })).toBeNull();
    expect(bad({ link: 'javascript:alert(1)' })).toBeNull();
    expect(bad({ photographer: '' })).toBeNull();
    expect(parsePhotos({ photos: [] })).toBeNull();
    expect(parsePhotos(null)).toBeNull();
  });
});

describe('weather formatting', () => {
  it('formats METAR visibility in km', () => {
    expect(fmtVisibility(6, true)).toBe('≥ 10 km');
    expect(fmtVisibility(1)).toBe('1.6 km');
    expect(fmtVisibility(undefined)).toBe('—');
  });

  it('formats ages over an hour', () => {
    expect(fmtAge(3_725_000)).toBe('1h 2m');
  });
});
