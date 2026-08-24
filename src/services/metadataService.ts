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

    jsmediatags.read(file, {
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
            let base64String = '';
            for (let i = 0; i < data.length; i++) {
              base64String += String.fromCharCode(data[i]);
            }
            
            const base64 = btoa(base64String);
            const dataUrl = `data:${format};base64,${base64}`;
            
            // Create a Blob from the base64 string
            const byteCharacters = atob(base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            
            // Explicitly pass a valid file extension to the blob for Cloudinary compatibility
            const extension = format.split('/')[1] || 'jpeg';
            const blob = new File([byteArray], `cover.${extension}`, { type: format });
            
            result.coverBlob = blob;
            result.coverDataUrl = dataUrl;
          } catch (e) {
            console.warn('Failed to parse picture data', e);
          }
        }

        resolve(result);
      },
      onError: (error) => {
        console.warn('Metadata extraction partial/failed for:', file.name, error.info);
        resolve(result); // Return whatever we have — nulls are fine
      }
    });
  });
}
