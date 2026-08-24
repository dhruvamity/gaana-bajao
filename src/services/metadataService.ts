/**
 * Metadata Extraction Service
 * Reads ID3v1, ID3v2, Vorbis Comments, FLAC, APE, etc. from audio files
 * using the music-metadata library. Extracts title, artist, album, genre,
 * year, track number, and embedded cover art.
 */

import { parseBlob } from 'music-metadata';

export interface ExtractedMetadata {
  title: string | null;
  artist: string | null;
  album: string | null;
  genre: string | null;
  year: number | null;
  trackNumber: number | null;
  duration: number | null;       // seconds
  coverDataUrl: string | null;   // data:image/... base64 URL for preview
  coverBlob: Blob | null;        // raw Blob for uploading to Cloudinary
}

/**
 * Extract metadata from an audio File using music-metadata's browser-compatible parseBlob.
 * Gracefully returns partial data — fields that can't be read are returned as null.
 */
export async function extractAudioMetadata(file: File): Promise<ExtractedMetadata> {
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

  try {
    const metadata = await parseBlob(file, { skipCovers: false });

    // Common tags (ID3v2, Vorbis, etc.)
    const common = metadata.common;

    if (common.title) result.title = common.title;
    if (common.artist) result.artist = common.artist;
    if (common.album) result.album = common.album;
    if (common.year) result.year = common.year;
    if (common.track?.no) result.trackNumber = common.track.no;

    // Genre — can be an array, take the first
    if (common.genre && common.genre.length > 0) {
      result.genre = common.genre[0];
    }

    // Duration from format info
    if (metadata.format?.duration) {
      result.duration = Math.round(metadata.format.duration);
    }

    // Embedded cover art (album art)
    if (common.picture && common.picture.length > 0) {
      const pic = common.picture[0];
      const mimeType = pic.format || 'image/jpeg';

      // Create a Blob from the picture data
      const blob = new Blob([pic.data], { type: mimeType });
      result.coverBlob = blob;

      // Create a data URL for preview
      result.coverDataUrl = await blobToDataUrl(blob);
    }
  } catch (err) {
    console.warn('Metadata extraction partial/failed for:', file.name, err);
    // Return whatever we have — nulls are fine
  }

  return result;
}

/**
 * Convert a Blob to a data URL string
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
