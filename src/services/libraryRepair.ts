/**
 * Library repair.
 *
 * Tracks uploaded by earlier builds may be missing artwork and metadata that is
 * actually present inside the audio file: either extraction was not running at
 * upload time, or the upload fell back to filename parsing. This rescans the
 * already-uploaded audio and recovers whatever the files really contain.
 *
 * Reading is done over HTTP range requests, so a scan pulls only the leading
 * bytes holding the ID3 tag rather than the whole audio file.
 */

import { Track } from '../types';
import { DatabaseService } from './firebase';
import { StorageService } from './storageService';
import { extractAudioMetadataFromUrl } from './metadataService';
import { isPlaceholderCover } from '../utils/coverArt';
import { slugifyArtistId } from '../utils/artistId';

export interface TrackScanResult {
  trackId: string;
  currentTitle: string;
  /** Tags were readable at all. */
  hasTags: boolean;
  /** An APIC/embedded picture frame is present. */
  hasEmbeddedArt: boolean;
  /** Track is currently showing generated/stock artwork rather than real art. */
  needsArt: boolean;
  /** Field-level differences worth applying, as `field: current -> proposed`. */
  proposedChanges: Array<{ field: keyof Track; from: string; to: string }>;
  error?: string;
}

export interface ScanSummary {
  total: number;
  scanned: number;
  withEmbeddedArt: number;
  withTags: number;
  needingArt: number;
  repairable: number;
  results: TrackScanResult[];
}

/**
 * Values that indicate a field was derived from a filename rather than a tag,
 * e.g. an "artist" of `001` produced by parsing `001 - Song Name.mp3`.
 */
function looksAutoDerived(value: string | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (/^\d{1,4}$/.test(trimmed)) return true;                 // 001, 42
  if (/^(unknown artist|untitled track|single|music)$/i.test(trimmed)) return true;
  return false;
}

/** Read one track's real tags without writing anything. */
export async function scanTrack(track: Track): Promise<TrackScanResult> {
  const result: TrackScanResult = {
    trackId: track.id,
    currentTitle: track.title,
    hasTags: false,
    hasEmbeddedArt: false,
    needsArt: isPlaceholderCover(track.coverUrl),
    proposedChanges: []
  };

  if (!track.audioUrl) {
    result.error = 'Track has no audio URL';
    return result;
  }

  try {
    const meta = await extractAudioMetadataFromUrl(track.audioUrl);

    result.hasTags = Boolean(meta.title || meta.artist || meta.album || meta.genre);
    result.hasEmbeddedArt = Boolean(meta.coverBlob);

    // Only propose a tag value over a field that was clearly auto-derived, so a
    // title the user edited by hand is never silently overwritten.
    const candidates: Array<[keyof Track, string | null, string]> = [
      ['title', meta.title, track.title],
      ['artist', meta.artist, track.artist],
      ['album', meta.album, track.album],
      ['genre', meta.genre, track.genre]
    ];

    for (const [field, proposed, current] of candidates) {
      if (!proposed) continue;
      const trimmed = proposed.trim();
      if (!trimmed || trimmed === current) continue;
      if (!looksAutoDerived(current)) continue;
      result.proposedChanges.push({ field, from: current || '(empty)', to: trimmed });
    }

    // The extracted blob is only needed during repair; release the preview URL.
    if (meta.coverDataUrl?.startsWith('blob:')) URL.revokeObjectURL(meta.coverDataUrl);
  } catch (err: any) {
    result.error = err?.message || 'Could not read tags';
  }

  return result;
}

/**
 * Rescan every track and report what could be recovered. Purely read-only.
 *
 * Runs a small number of range requests in parallel; more than that and
 * Cloudinary starts throttling, which shows up as spurious read failures.
 */
export async function scanLibrary(
  onProgress?: (done: number, total: number) => void,
  concurrency = 4
): Promise<ScanSummary> {
  const tracks = await DatabaseService.getTracks();
  const results: TrackScanResult[] = [];
  let done = 0;

  const queue = [...tracks];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (;;) {
      const track = queue.shift();
      if (!track) return;
      results.push(await scanTrack(track));
      onProgress?.(++done, tracks.length);
    }
  });
  await Promise.all(workers);

  return {
    total: tracks.length,
    scanned: results.length,
    withEmbeddedArt: results.filter(r => r.hasEmbeddedArt).length,
    withTags: results.filter(r => r.hasTags).length,
    needingArt: results.filter(r => r.needsArt).length,
    repairable: results.filter(
      r => (r.needsArt && r.hasEmbeddedArt) || r.proposedChanges.length > 0
    ).length,
    results
  };
}

export interface RepairOptions {
  /** Upload embedded artwork for tracks currently showing a generated cover. */
  restoreArtwork: boolean;
  /** Replace filename-derived title/artist/album/genre with real tag values. */
  restoreMetadata: boolean;
}

export interface RepairSummary {
  attempted: number;
  artworkRestored: number;
  metadataRestored: number;
  failed: Array<{ trackId: string; title: string; error: string }>;
}

/**
 * Apply the recoverable changes found by a scan. Only touches tracks the scan
 * marked repairable, and re-reads artwork at apply time so the potentially
 * large image blob is never held for the whole library at once.
 */
export async function repairLibrary(
  scan: ScanSummary,
  options: RepairOptions,
  onProgress?: (done: number, total: number, label: string) => void
): Promise<RepairSummary> {
  const tracks = await DatabaseService.getTracks();
  const byId = new Map(tracks.map(t => [t.id, t]));

  const targets = scan.results.filter(
    r =>
      (options.restoreArtwork && r.needsArt && r.hasEmbeddedArt) ||
      (options.restoreMetadata && r.proposedChanges.length > 0)
  );

  const summary: RepairSummary = {
    attempted: targets.length,
    artworkRestored: 0,
    metadataRestored: 0,
    failed: []
  };

  let done = 0;
  for (const target of targets) {
    const track = byId.get(target.trackId);
    if (!track) {
      done++;
      continue;
    }

    try {
      let updated: Track = { ...track };
      let changed = false;

      if (options.restoreMetadata && target.proposedChanges.length > 0) {
        for (const change of target.proposedChanges) {
          (updated as any)[change.field] = change.to;
        }
        // Keep the derived artist id consistent with the recovered artist name.
        const artistChange = target.proposedChanges.find(c => c.field === 'artist');
        if (artistChange) updated.artistId = slugifyArtistId(artistChange.to);
        summary.metadataRestored++;
        changed = true;
      }

      if (options.restoreArtwork && target.needsArt && target.hasEmbeddedArt) {
        const meta = await extractAudioMetadataFromUrl(track.audioUrl);
        if (meta.coverBlob) {
          updated.coverUrl = await StorageService.saveImageBlob(`cover_${track.id}`, meta.coverBlob);
          summary.artworkRestored++;
          changed = true;
        }
        if (meta.coverDataUrl?.startsWith('blob:')) URL.revokeObjectURL(meta.coverDataUrl);
      }

      if (changed) await DatabaseService.saveTrack(updated);
    } catch (err: any) {
      summary.failed.push({
        trackId: target.trackId,
        title: target.currentTitle,
        error: err?.message || 'Repair failed'
      });
    }

    onProgress?.(++done, targets.length, target.currentTitle);
  }

  return summary;
}
