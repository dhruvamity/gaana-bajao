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
import { extractAudioMetadataFromUrl, probeAudioTagsFromUrl, RemoteTagProbe } from './metadataService';
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
  /** Track predates ownership and cannot be written once rules are enforced. */
  missingOwner: boolean;
  /**
   * The media host answered *definitively* that the audio is gone — 404 or 410.
   *
   * Deliberately narrower than the `unreadable` diagnosis, which also covers
   * CORS rejections and transient network failures. Removal keys off this flag
   * and nothing else, because deleting a track on a temporary blip would be
   * unrecoverable: the audio is already gone from storage, so the document is
   * the only record that the track ever existed.
   */
  sourceMissing: boolean;
  /** HTTP status the media host returned, when it returned one at all. */
  httpStatus: number | null;
  /** Why this track yielded nothing, when it yielded nothing. */
  diagnosis: Diagnosis;
  detail?: string;
  error?: string;
}

/**
 * Distinguishing these matters: a CORS failure, a host that strips metadata,
 * and a genuinely untagged file all produce "no artwork found", but only one of
 * them is a bug and each needs a different response.
 */
export type Diagnosis =
  | 'artwork-available'    // embedded art present and recoverable
  | 'tags-no-artwork'      // tags read, but the file has no picture frame
  | 'stripped-on-host'     // valid audio, ID3 tag absent from the stored copy
  | 'source-missing'       // host said 404/410 — the audio object is gone
  | 'unreadable'           // could not fetch or parse, reason unknown
  | 'already-correct';     // nothing to do

export interface ScanSummary {
  total: number;
  scanned: number;
  withEmbeddedArt: number;
  withTags: number;
  needingArt: number;
  repairable: number;
  missingOwner: number;
  /** Tracks whose audio object no longer exists. Removable, not repairable. */
  missingSource: number;
  /** Count of tracks per diagnosis, so the outcome can be explained precisely. */
  byDiagnosis: Record<Diagnosis, number>;
  results: TrackScanResult[];
}

/**
 * Whether the stored value is confidently better than what the file declares.
 *
 * Only a value that looks deliberately curated is protected. Everything else is
 * proposed for replacement, because a bulk upload derives title/artist/album
 * from the filename and those values look perfectly plausible - "001" as an
 * artist is obvious, but "Kaho Na Kaho (Lyric Video) | Murder" as a title is
 * not, and it is still filename noise rather than the song's real title.
 *
 * Every proposal is shown in a preview before anything is written, so the
 * bias is toward surfacing the file's own metadata and letting the user judge.
 */
function isProtectedValue(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^\d{1,4}$/.test(trimmed)) return false;                       // 001, 42
  if (/^(unknown artist|untitled track|single|music)$/i.test(trimmed)) return false;
  // Hallmarks of a filename rather than a tag.
  if (/\.(mp3|m4a|flac|wav|ogg|aac|opus)\b/i.test(trimmed)) return false;
  if (/\((official|lyric|lyrical|full)\b[^)]*\)/i.test(trimmed)) return false;
  if (/\b(full (video|audio) song|lyric video|official video|audio song)\b/i.test(trimmed)) return false;
  if (/\|/.test(trimmed)) return false;                              // "Song | Movie"
  if (/^["'\s]/.test(value)) return false;                           // leading quote/space
  if (/_(spotdown|ytmp3|320kbps)/i.test(trimmed)) return false;
  return true;
}

/** Read one track's real tags without writing anything. */
export async function scanTrack(track: Track): Promise<TrackScanResult> {
  const result: TrackScanResult = {
    trackId: track.id,
    currentTitle: track.title,
    hasTags: false,
    hasEmbeddedArt: false,
    needsArt: isPlaceholderCover(track.coverUrl),
    proposedChanges: [],
    missingOwner: !track.ownerId,
    sourceMissing: false,
    httpStatus: null,
    diagnosis: 'unreadable'
  };

  if (!track.audioUrl) {
    result.error = 'Track has no audio URL';
    return result;
  }

  let probe: RemoteTagProbe;
  try {
    probe = await probeAudioTagsFromUrl(track.audioUrl);
  } catch (err: any) {
    result.error = err?.message || 'Could not read tags';
    return result;
  }

  result.httpStatus = probe.httpStatus;
  // 404/410 are the host stating the object is gone. A thrown fetch leaves
  // httpStatus null, which must NOT be treated as missing.
  result.sourceMissing = probe.httpStatus === 404 || probe.httpStatus === 410;

  result.detail =
    `HTTP ${probe.httpStatus ?? '-'} | container ${probe.container ?? '-'} | ` +
    `${(probe.bytesRead / 1024).toFixed(1)} KB read`;

  if (!probe.ok) {
    result.error = probe.error ?? 'Could not read tags';
    result.diagnosis = result.sourceMissing ? 'source-missing' : 'unreadable';
    return result;
  }

  try {
    const meta = probe.metadata;

    result.hasTags = Boolean(meta.title || meta.artist || meta.album || meta.genre);
    result.hasEmbeddedArt = Boolean(meta.coverBlob);

    // Propose the file's own value wherever it differs and the stored value is
    // not obviously hand-curated.
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
      if (isProtectedValue(current)) continue;
      result.proposedChanges.push({ field, from: current || '(empty)', to: trimmed });
    }

    // The extracted blob is only needed during repair; release the preview URL.
    if (meta.coverDataUrl?.startsWith('blob:')) URL.revokeObjectURL(meta.coverDataUrl);

    if (result.hasEmbeddedArt && result.needsArt) {
      result.diagnosis = 'artwork-available';
    } else if (probe.container === 'mpeg-no-tag') {
      // Valid audio with no tag container at all: either the source never had
      // one, or it was removed somewhere between upload and delivery.
      result.diagnosis = 'stripped-on-host';
      result.detail = (result.detail ? result.detail + ' | ' : '') + (probe.error ?? 'no tag found');
    } else if (!result.hasEmbeddedArt) {
      // A tag container exists but holds no picture frame (and possibly no
      // usable text frames either).
      result.diagnosis = 'tags-no-artwork';
    } else {
      result.diagnosis = 'already-correct';
    }
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

  const byDiagnosis: Record<Diagnosis, number> = {
    'artwork-available': 0,
    'tags-no-artwork': 0,
    'stripped-on-host': 0,
    'source-missing': 0,
    'unreadable': 0,
    'already-correct': 0
  };
  for (const r of results) byDiagnosis[r.diagnosis]++;

  return {
    total: tracks.length,
    scanned: results.length,
    withEmbeddedArt: results.filter(r => r.hasEmbeddedArt).length,
    withTags: results.filter(r => r.hasTags).length,
    needingArt: results.filter(r => r.needsArt).length,
    missingOwner: results.filter(r => r.missingOwner).length,
    missingSource: results.filter(r => r.sourceMissing).length,
    repairable: results.filter(
      r => (r.needsArt && r.hasEmbeddedArt) || r.proposedChanges.length > 0 || r.missingOwner
    ).length,
    byDiagnosis,
    results
  };
}

export interface RepairOptions {
  /** Upload embedded artwork for tracks currently showing a generated cover. */
  restoreArtwork: boolean;
  /** Replace filename-derived title/artist/album/genre with real tag values. */
  restoreMetadata: boolean;
  /**
   * Stamp ownership onto tracks uploaded before the field existed. Security
   * rules key writes off ownerId, so without this those tracks become
   * permanently read-only the moment rules are enforced.
   */
  claimOwnership?: { userId: string; userName: string };
}

export interface RepairSummary {
  attempted: number;
  artworkRestored: number;
  metadataRestored: number;
  ownershipClaimed: number;
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
      (options.restoreMetadata && r.proposedChanges.length > 0) ||
      (!!options.claimOwnership && r.missingOwner)
  );

  const summary: RepairSummary = {
    attempted: targets.length,
    artworkRestored: 0,
    metadataRestored: 0,
    ownershipClaimed: 0,
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

      if (options.claimOwnership && !updated.ownerId) {
        updated.ownerId = options.claimOwnership.userId;
        updated.ownerName = options.claimOwnership.userName;
        summary.ownershipClaimed++;
        changed = true;
      }

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

export interface RemovalSummary {
  attempted: number;
  removed: number;
  failed: Array<{ trackId: string; title: string; error: string }>;
}

/**
 * Delete the catalogue entries whose audio object no longer exists.
 *
 * Only touches results flagged `sourceMissing` — a definitive 404/410 from the
 * media host. A track that merely failed to load (CORS, a dropped connection,
 * a host hiccup) is never removed, because the audio is already unrecoverable
 * and the document is the only remaining record that the track existed.
 *
 * `deleteTrack` also pulls the id out of every playlist that referenced it, so
 * removal does not leave playlists pointing at nothing.
 */
export async function removeMissingSourceTracks(
  scan: ScanSummary,
  onProgress?: (done: number, total: number, label: string) => void
): Promise<RemovalSummary> {
  const targets = scan.results.filter(r => r.sourceMissing);

  const summary: RemovalSummary = {
    attempted: targets.length,
    removed: 0,
    failed: []
  };

  let done = 0;
  for (const target of targets) {
    try {
      await DatabaseService.deleteTrack(target.trackId);
      summary.removed++;
    } catch (err: any) {
      summary.failed.push({
        trackId: target.trackId,
        title: target.currentTitle,
        error: err?.message || 'Could not remove this track'
      });
    }
    onProgress?.(++done, targets.length, target.currentTitle);
  }

  return summary;
}
