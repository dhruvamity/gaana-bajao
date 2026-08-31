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

/** What a remote tag read actually found, including why it found nothing. */
export interface RemoteTagProbe {
  /** The tag region was fetched and parsed without a transport error. */
  ok: boolean;
  httpStatus: number | null;
  bytesRead: number;
  /**
   * Container detected from the leading bytes. `mpeg-no-tag` means valid audio
   * whose ID3v2 tag is simply absent — which is what a host that strips
   * metadata on delivery produces.
   */
  container: 'id3v2' | 'mp4' | 'flac' | 'ogg' | 'mpeg-no-tag' | 'unknown' | null;
  metadata: ExtractedMetadata;
  error: string | null;
}

function detectContainer(head: Uint8Array): RemoteTagProbe['container'] {
  if (head.length < 12) return 'unknown';
  const ascii = (o: number, n: number) =>
    String.fromCharCode(...Array.from(head.slice(o, o + n)));
  if (ascii(0, 3) === 'ID3') return 'id3v2';
  if (ascii(4, 4) === 'ftyp') return 'mp4';
  if (ascii(0, 4) === 'fLaC') return 'flac';
  if (ascii(0, 4) === 'OggS') return 'ogg';
  // MPEG audio frame sync: 11 set bits.
  if (head[0] === 0xff && (head[1] & 0xe0) === 0xe0) return 'mpeg-no-tag';
  return 'unknown';
}

/**
 * Fast check to determine if an audio resource is definitively missing from Cloudinary (HTTP 404 or 410).
 * Returns true if and only if the host explicitly responds with 404 or 410.
 * Returns false on successful responses, or if network/CORS fails (preventing false-positive deletion).
 */
export async function isAudioUrlMissing(url: string | undefined | null): Promise<boolean> {
  if (!url || typeof url !== 'string' || !url.trim()) return true;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      signal: AbortSignal.timeout(5000)
    });
    return res.status === 404 || res.status === 410;
  } catch (err) {
    // Cross-origin or network failures do not mean the file is deleted.
    return false;
  }
}

/**
 * Read remote tags and report exactly what happened.
 *
 * A transport failure and a genuinely untagged file are very different
 * problems, and reporting both as "no metadata" makes the difference
 * undiagnosable. This keeps them apart.
 */
export async function probeAudioTagsFromUrl(url: string): Promise<RemoteTagProbe> {
  const probe: RemoteTagProbe = {
    ok: false,
    httpStatus: null,
    bytesRead: 0,
    container: null,
    metadata: emptyMetadata(),
    error: null
  };

  if (!url) {
    probe.error = 'Track has no audio URL';
    return probe;
  }

  let head: Response;
  try {
    head = await fetchRange(url, 0, 15);
  } catch (err: any) {
    // A cross-origin failure surfaces here as an opaque TypeError.
    probe.error =
      `Could not read the audio file (${err?.message || 'network error'}). ` +
      `This is usually a CORS restriction on the media host.`;
    return probe;
  }

  probe.httpStatus = head.status;
  if (!head.ok) {
    probe.error = `Media host returned HTTP ${head.status}`;
    return probe;
  }

  try {
    let region: Blob;
    if (head.status === 200) {
      // Host ignored Range and sent the whole body; nothing to gain from a second request.
      region = await head.blob();
      probe.container = detectContainer(new Uint8Array(await region.slice(0, 16).arrayBuffer()));
    } else {
      const header = new Uint8Array(await head.arrayBuffer());
      probe.container = detectContainer(header);

      if (probe.container === 'id3v2') {
        const tagSize =
          (header[6] << 21) | (header[7] << 14) | (header[8] << 7) | header[9];
        const end = 10 + tagSize + 1024;
        const tagResponse = await fetchRange(url, 0, end);
        if (!tagResponse.ok) {
          probe.error = `Media host returned HTTP ${tagResponse.status} for the tag range`;
          return probe;
        }
        region = await tagResponse.blob();
      } else {
        const wide = await fetchRange(url, 0, PROBE_BYTES - 1);
        if (!wide.ok) {
          probe.error = `Media host returned HTTP ${wide.status}`;
          return probe;
        }
        region = await wide.blob();
      }
    }

    probe.bytesRead = region.size;
    probe.metadata = await readTags(
      new File([region], 'remote-audio', { type: 'audio/mpeg' })
    );
    probe.ok = true;

    if (probe.container === 'mpeg-no-tag' && !probe.metadata.title) {
      probe.error =
        'Valid audio, but no ID3 tag at the start of the file. The stored copy ' +
        'has no embedded metadata — media hosts commonly strip it on upload or delivery.';
    }
    return probe;
  } catch (err: any) {
    probe.error = err?.message || 'Failed to parse the tag region';
    return probe;
  }
}

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
  return (await probeAudioTagsFromUrl(url)).metadata;
}

async function fetchRange(url: string, start: number, endInclusive: number): Promise<Response> {
  return fetch(url, {
    headers: { Range: `bytes=${start}-${endInclusive}` },
    // Explicit CORS mode: an opaque response would give us an unreadable body.
    mode: 'cors',
    credentials: 'omit'
  });
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
