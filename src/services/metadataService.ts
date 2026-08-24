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

/**
 * Extract metadata from an already-uploaded audio URL.
 *
 * jsmediatags reads remote sources with HTTP range requests, so this pulls only
 * the leading bytes containing the ID3 tag rather than the whole audio file —
 * which makes it viable to rescan an entire library.
 */
export function extractAudioMetadataFromUrl(url: string): Promise<ExtractedMetadata> {
  return readTags(url);
}

function readTags(source: File | string): Promise<ExtractedMetadata> {
  return new Promise((resolve) => {
    const result: ExtractedMetadata = {
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
        const label = typeof source === 'string' ? source : source.name;
        console.warn('Metadata extraction partial/failed for:', label, error?.info);
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
