/**
 * Deterministic generated cover art.
 *
 * When a track carries no embedded ID3 artwork there is nothing to display, and
 * pointing every such track at one shared stock photo makes an entire library
 * look like a single album. Instead we derive a unique cover from the track's
 * own identity, so two different songs never collide and the same song always
 * renders the same artwork across reloads and devices.
 *
 * Output is a self-contained SVG data URI: no network request, nothing to store
 * in Firestore, and it cannot 404 later.
 */

/** FNV-1a — small, fast, well-distributed for short strings. */
function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Up to two initials, preferring the title and falling back to the artist.
 * Skips leading noise so `" Dil Tu Hi Bataa "` yields `D` rather than a space,
 * and a purely numeric name like `001` falls through to the artist.
 */
export function getCoverInitials(title?: string, artist?: string): string {
  const pick = (value?: string): string | null => {
    if (!value) return null;
    const words = value
      .replace(/[("[{].*?[)\]}]/g, ' ')      // drop "(Lyric Video)", "[HD]", ...
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')      // strip punctuation, keep any script
      .split(/\s+/)
      .filter(w => w.length > 0 && !/^\d+$/.test(w));
    if (words.length === 0) return null;
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  };
  return pick(title) || pick(artist) || '♪'; // eighth note
}

export interface CoverArtSeed {
  title?: string;
  artist?: string;
  id?: string;
}

/**
 * Build an SVG data URI cover for a track.
 *
 * The palette is seeded from the track identity but constrained to the app's
 * dark, cool-leaning surface range so generated covers still read as part of
 * the same product rather than as random noise.
 */
export function generateCoverArt(seed: CoverArtSeed, size = 600): string {
  const identity = `${seed.artist ?? ''}::${seed.title ?? ''}::${seed.id ?? ''}`;
  const hash = hashString(identity || 'gaana-bajao');

  // Two related hues, always a pleasing 30-110 degrees apart.
  const hueA = hash % 360;
  const hueB = (hueA + 30 + ((hash >>> 9) % 80)) % 360;
  const satA = 58 + ((hash >>> 4) % 22);   // 58-79%
  const satB = 52 + ((hash >>> 13) % 26);  // 52-77%
  const lightA = 22 + ((hash >>> 17) % 12); // 22-33%  (deep)
  const lightB = 44 + ((hash >>> 21) % 14); // 44-57%  (mid)

  const angle = (hash >>> 25) % 4;         // one of four gradient directions
  const [x1, y1, x2, y2] = [
    ['0%', '0%', '100%', '100%'],
    ['100%', '0%', '0%', '100%'],
    ['0%', '50%', '100%', '50%'],
    ['50%', '0%', '50%', '100%']
  ][angle];

  // A few concentric rings, offset by the hash — reads as vinyl/waveform
  // texture and guarantees two covers with similar hues still look different.
  const cx = 30 + ((hash >>> 3) % 40);
  const cy = 28 + ((hash >>> 11) % 44);
  const rings = [18, 30, 43, 57]
    .map((r, i) => {
      const opacity = (0.16 - i * 0.03).toFixed(2);
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#fff" stroke-opacity="${opacity}" stroke-width="0.9"/>`;
    })
    .join('');

  const initials = getCoverInitials(seed.title, seed.artist);
  const fontSize = initials.length > 1 ? 26 : 34;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">` +
    `<defs><linearGradient id="g" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">` +
    `<stop offset="0%" stop-color="hsl(${hueA} ${satA}% ${lightA}%)"/>` +
    `<stop offset="100%" stop-color="hsl(${hueB} ${satB}% ${lightB}%)"/>` +
    `</linearGradient></defs>` +
    `<rect width="100" height="100" fill="url(#g)"/>` +
    rings +
    `<text x="50" y="50" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="Inter, system-ui, sans-serif" font-weight="700" font-size="${fontSize}" ` +
    `fill="#fff" fill-opacity="0.9" letter-spacing="1">${escapeXml(initials)}</text>` +
    `</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Legacy stock-photo URLs that earlier builds assigned to every track that had
 * no embedded artwork. Treated as "no cover" so those tracks fall through to a
 * generated one instead of all rendering the same image.
 */
const PLACEHOLDER_MARKERS = [
  'photo-1618005182384-a83a8bd57fbe',
  'photo-1614613535308-eb5fbd3d2c17',
  'photo-1509198397868-475647b2a1e5',
  'photo-1518709268805-4e9042af9f23',
  'photo-1507525428034-b723cf961d3e',
  'photo-1518609878373-06d740f60d8b'
];

export function isPlaceholderCover(url?: string | null): boolean {
  if (!url) return true;
  return PLACEHOLDER_MARKERS.some(marker => url.includes(marker));
}

/**
 * The cover to actually render: the real artwork when there is one, otherwise a
 * generated cover unique to this track.
 */
export function resolveCoverUrl(seed: CoverArtSeed & { coverUrl?: string | null }, size?: number): string {
  if (!isPlaceholderCover(seed.coverUrl)) return seed.coverUrl as string;
  return generateCoverArt(seed, size);
}
