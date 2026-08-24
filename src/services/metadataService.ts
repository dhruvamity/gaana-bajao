/**
 * Metadata Extraction Service
 * Reads ID3 tags from audio files using jsmediatags,
 * which is highly compatible with browser environments.
 * Extracts title, artist, album, genre, year, track number, and embedded cover art.
 */

// @ts-ignore
import jsmediatags from 'jsmediatags/dist/jsmediatags.min.js';

export interface ExtractedMetadata {
  title: string | null;
  artist: string | null;
  album: string | null;
  genre: string | null;
  year: number | null;
  trackNumber: number | null;
  duration: number | null;       // seconds (not supported by jsmediatags directly, fallback to AudioEngine)
  coverDataUrl: string | null;   // data:image/... base64 URL for preview
  coverBlob: Blob | null;        // raw Blob for uploading to Cloudinary
}

/**
 * Extract metadata from an audio File using jsmediatags.
 * Gracefully returns partial data — fields that can't be read are returned as null.
 */
export function extractAudioMetadata(file: File): Promise<ExtractedMetadata> {
  return readTags(file);
}

/** How much of a file to pull when its ID3 header does not declare a tag size. */
const PROBE_BYTES = 512 * 1024;

/**
 * Extract metadata from an already-uploaded audio URL.
 *
 * Rather than handing the URL to jsmediatags — whose XHR reader needs to read
 * Content-Length and Content-Range off the response, which cross-origin hosts
 * do not expose unless they set Access-Control-Expose-Headers, and which fails
 * silently when they don't — this fetches a bounded prefix itself and parses
 * the resulting Blob. `fetch` only needs the body, so plain
 * Access-Control-Allow-Origin is enough.
 *
 * An ID3v2 header declares its own length, so for a tagged MP3 this reads
 * exactly the tag and nothing more: about 26 KB for a track with embedded
 * artwork, instead of the whole multi-megabyte file.
 */
export async function extractAudioMetadataFromUrl(url: string): Promise<ExtractedMetadata> {
  const blob = await fetchTagRegion(url);
  if (!blob) return emptyMetadata();
  return readTags(new File([blob], 'remote-audio', { type: 'audio/mpeg' }));
}

async function fetchRange(url: string, start: number, endInclusive: number): Promise<Response> {
  return fetch(url, {
    headers: { Range: `bytes=${start}-${endInclusive}` },
    // Explicit CORS mode: an opaque response would give us an unreadable body.
    mode: 'cors',
    credentials: 'omit'
  });
}

/**
 * Fetch just the region of the file that can contain tags.
 * Returns null when the resource cannot be read at all.
 */
async function fetchTagRegion(url: string): Promise<Blob | null> {
  try {
    // Read the 10-byte ID3v2 header, which declares the tag length.
    const head = await fetchRange(url, 0, 9);
    if (!head.ok) return null;

    // A host that ignores Range answers 200 with the entire body; in that case
    // there is nothing to gain from a second request.
    if (head.status === 200) {
      return await head.blob();
    }

    const header = new Uint8Array(await head.arrayBuffer());
    if (header.length >= 10 && header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33) {
      // Synchsafe integer: 7 significant bits per byte.
      const tagSize =
        (header[6] << 21) | (header[7] << 14) | (header[8] << 7) | header[9];
      // Header + declared tag, plus a small margin for an extended header.
      const end = 10 + tagSize + 1024;
      const tagResponse = await fetchRange(url, 0, end);
      if (!tagResponse.ok) return null;
      return await tagResponse.blob();
    }

    // Not ID3v2 (could be an MP4/M4A `moov` atom or a FLAC block). Pull a
    // bounded probe and let the parser look for what it recognises.
    const probe = await fetchRange(url, 0, PROBE_BYTES - 1);
    if (!probe.ok) return null;
    return await probe.blob();
  } catch (err) {
    console.warn('Could not read tag region for', url, err);
    return null;
  }
}

function emptyMetadata(): ExtractedMetadata {
  return {
    title: null,
    artist: null,
    album: null,
    genre: null,
    year: null,
    trackNumber: null,
    duration: null,
    coverDataUrl: null,
    coverBlob: null
  };
}

function readTags(source: File): Promise<ExtractedMetadata> {
  return new Promise((resolve) => {
    const result: ExtractedMetadata = emptyMetadata();

    jsmediatags.read(source, {
      onSuccess: async (tag) => {
        const tags = tag.tags;

        if (tags.title) result.title = tags.title;
        if (tags.artist) result.artist = tags.artist;
        if (tags.album) result.album = tags.album;
        if (tags.genre) result.genre = tags.genre;
        if (tags.year) result.year = parseInt(tags.year) || null;
        if (tags.track) {
          const trackNum = parseInt(tags.track.split('/')[0]);
          result.trackNumber = isNaN(trackNum) ? null : trackNum;
        }

        // Embedded cover art (album art)
        if (tags.picture) {
          try {
            const { data, format } = tags.picture;

            // Bytes straight to a typed array — no base64 round trip. Cover art
            // is routinely several megabytes, and the previous
            // bytes -> binary string -> btoa -> atob -> bytes path allocated
            // roughly four copies of it per file.
            const byteArray = new Uint8Array(data.length);
            for (let i = 0; i < data.length; i++) byteArray[i] = data[i];

            const mime = normaliseImageMime(format);
            const extension = mime.split('/')[1] || 'jpeg';
            // A real filename keeps Cloudinary's format detection happy.
            result.coverBlob = new File([byteArray], `cover.${extension}`, { type: mime });
            result.coverDataUrl = URL.createObjectURL(result.coverBlob);
          } catch (e) {
            console.warn('Failed to parse picture data', e);
          }
        }

        resolve(result);
      },
      onError: (error) => {
        console.warn('Metadata extraction partial/failed for:', source.name, error?.info);
        resolve(result); // Return whatever we have — nulls are fine
      }
    });
  });
}

/**
 * ID3 picture frames carry a MIME type that is not always a well-formed one:
 * ID3v2.2 uses a bare format code ("JPG"/"PNG"), and some taggers write junk.
 */
function normaliseImageMime(format?: string): string {
  const value = (format || '').trim().toLowerCase();
  if (value.startsWith('image/')) return value;
  if (value.includes('png')) return 'image/png';
  if (value.includes('gif')) return 'image/gif';
  if (value.includes('webp')) return 'image/webp';
  return 'image/jpeg';
}
