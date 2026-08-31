import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Wand2, Search, AlertCircle, Check, Image as ImageIcon, Tag, Loader2, ShieldCheck, Info, Trash2 } from 'lucide-react';
import {
  scanLibrary,
  repairLibrary,
  removeMissingSourceTracks,
  ScanSummary,
  RepairSummary,
  RemovalSummary
} from '../services/libraryRepair';

/**
 * Recovers artwork and metadata that exists inside already-uploaded audio files
 * but never made it into the catalog.
 *
 * Scanning is read-only and always runs first, so the result of a repair is
 * visible before anything is written.
 */
/** Plain-language explanation for each scan outcome. */
const DIAGNOSIS_COPY: Record<string, { label: string; detail: string; tone: 'good' | 'warn' | 'bad' }> = {
  'artwork-available': {
    label: 'Embedded artwork found',
    detail: 'The file contains cover art that is not yet in your library. Repair will restore it.',
    tone: 'good'
  },
  'tags-no-artwork': {
    label: 'No cover art inside the file',
    detail:
      'The file has a tag container but no embedded picture, so there is no artwork to extract. ' +
      'A cover generated from the track name is used instead.',
    tone: 'warn'
  },
  'stripped-on-host': {
    label: 'No tags in the stored file',
    detail:
      'The audio is valid but carries no ID3 tag. The original file may never have had one, or the metadata was ' +
      'removed when the file was uploaded. Re-uploading the tagged original is the only way to recover it.',
    tone: 'bad'
  },
  'source-missing': {
    label: 'Audio file no longer exists',
    detail:
      'The media host confirmed the audio object is gone (404). The catalogue entry survives because track ' +
      'records live in the database, which knows nothing about the stored files — so the track still appears ' +
      'but can never play. Re-upload the audio, or remove the entry below.',
    tone: 'bad'
  },
  'unreadable': {
    label: 'Could not read the file',
    detail:
      'The audio could not be fetched or parsed, and the host gave no definitive answer. Usually a CORS ' +
      'restriction or a transient network failure. These are never removed automatically — the file may be fine.',
    tone: 'bad'
  },
  'already-correct': {
    label: 'Already correct',
    detail: 'This track already has the artwork and metadata its file contains.',
    tone: 'good'
  }
};

export const LibraryRepairPanel: React.FC = () => {
  const { currentUser } = useAuth();
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'scanned' | 'repairing' | 'done'>('idle');
  const [progress, setProgress] = useState<{ done: number; total: number; label?: string }>({ done: 0, total: 0 });
  const [scan, setScan] = useState<ScanSummary | null>(null);
  const [repair, setRepair] = useState<RepairSummary | null>(null);
  const [removal, setRemoval] = useState<RemovalSummary | null>(null);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [restoreArtwork, setRestoreArtwork] = useState(true);
  const [restoreMetadata, setRestoreMetadata] = useState(true);
  const [claimOwnership, setClaimOwnership] = useState(true);

  /* What the button will actually touch, given the boxes currently ticked.
     `scan.repairable` counts everything repairable by ANY option, so using it
     as the label overstated the job whenever an option was unticked. This
     mirrors the predicate repairLibrary() itself uses. */
  const repairTargetCount = useMemo(() => {
    if (!scan) return 0;
    return scan.results.filter(
      r =>
        (restoreArtwork && r.needsArt && r.hasEmbeddedArt) ||
        (restoreMetadata && r.proposedChanges.length > 0) ||
        (claimOwnership && !!currentUser && r.missingOwner)
    ).length;
  }, [scan, restoreArtwork, restoreMetadata, claimOwnership, currentUser]);

  const handleScan = async () => {
    setPhase('scanning');
    setError(null);
    setRepair(null);
    setProgress({ done: 0, total: 0 });
    try {
      const summary = await scanLibrary((done, total) => setProgress({ done, total }));
      setScan(summary);
      setPhase('scanned');
    } catch (err: any) {
      setError(err?.message || 'Scan failed.');
      setPhase('idle');
    }
  };

  const handleRepair = async () => {
    if (!scan) return;
    setPhase('repairing');
    setError(null);
    try {
      const summary = await repairLibrary(
        scan,
        {
          restoreArtwork,
          restoreMetadata,
          claimOwnership:
            claimOwnership && currentUser
              ? { userId: currentUser.id, userName: currentUser.name }
              : undefined
        },
        (done, total, label) => setProgress({ done, total, label })
      );
      setRepair(summary);
      setPhase('done');
    } catch (err: any) {
      setError(err?.message || 'Repair failed.');
      setPhase('scanned');
    }
  };

  const handleRemoveMissing = async () => {
    if (!scan) return;
    setPhase('repairing');
    setError(null);
    try {
      const summary = await removeMissingSourceTracks(
        scan,
        (done, total, label) => setProgress({ done, total, label })
      );
      setRemoval(summary);
      setConfirmRemoval(false);
      // The scan describes tracks that no longer exist, so it must not be
      // reused to drive another action.
      setScan(null);
      setPhase('done');
    } catch (err: any) {
      setError(err?.message || 'Could not remove the tracks.');
      setPhase('scanned');
    }
  };

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const busy = phase === 'scanning' || phase === 'repairing';

  return (
    <div className="space-y-4">
      <div className="p-3.5 rounded-lg bg-primary/10 border border-white/10 text-xs text-primary font-medium flex items-start gap-2">
        <Wand2 size={16} className="flex-shrink-0 mt-0.5" />
        <span>
          Re-reads the ID3 tags inside your uploaded audio files to recover album art, titles and
          artist names that were missed at upload. Scanning only reads the first few kilobytes of
          each file and changes nothing.
        </span>
      </div>

      {error && (
        <div className="p-3.5 rounded bg-error/15 border border-error/30 text-error text-xs flex items-center gap-2">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {busy && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-bold text-white">
            <span>
              {phase === 'scanning' ? 'Reading tags' : 'Repairing'}
              {progress.label ? ` — ${progress.label}` : ''}
            </span>
            <span className="tabular-nums">
              {progress.done}/{progress.total || '?'}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-primary transition-all duration-300 rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {removal && !busy && (
        <div className="p-3.5 rounded border border-emerald-500/25 bg-emerald-500/10 text-[11px] text-emerald-200 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <Check size={13} />
            <span>Removed {removal.removed} of {removal.attempted} unavailable {removal.attempted === 1 ? 'track' : 'tracks'}</span>
          </div>
          {removal.failed.length > 0 && (
            <p className="opacity-80">{removal.failed.length} could not be removed &mdash; {removal.failed[0].error}</p>
          )}
          <p className="opacity-70">Scan again to see the library as it stands now.</p>
        </div>
      )}

      {scan && !busy && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Tracks', value: scan.total },
              { label: 'With tags', value: scan.withTags },
              { label: 'With art', value: scan.withEmbeddedArt },
              { label: 'Repairable', value: scan.repairable }
            ].map(stat => (
              <div key={stat.label} className="p-3 rounded bg-surface-container-high/60 border border-white/5">
                <div className="text-lg font-black text-white tabular-nums">{stat.value}</div>
                <div className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Why each track produced the result it did */}
          <div className="space-y-1.5">
            {Object.entries(scan.byDiagnosis)
              .filter(([, count]) => count > 0)
              .map(([key, count]) => {
                const copy = DIAGNOSIS_COPY[key];
                if (!copy) return null;
                const tone =
                  copy.tone === 'good' ? 'text-emerald-300 border-emerald-500/25 bg-emerald-500/10'
                  : copy.tone === 'warn' ? 'text-amber-300 border-amber-500/25 bg-amber-500/10'
                  : 'text-error border-error/25 bg-error/10';
                const example = scan.results.find(r => r.diagnosis === key && (r.detail || r.error));
                return (
                  <div key={key} className={`p-3 rounded border text-[11px] leading-relaxed ${tone}`}>
                    <div className="font-bold flex items-center gap-1.5">
                      <Info size={12} />
                      <span>{count} {count === 1 ? 'track' : 'tracks'} &mdash; {copy.label}</span>
                    </div>
                    <p className="opacity-80 mt-0.5">{copy.detail}</p>
                    {example && (example.error || example.detail) && (
                      <p className="opacity-60 mt-1 font-mono text-[10px] break-all">
                        e.g. {example.currentTitle}: {example.error || example.detail}
                      </p>
                    )}
                  </div>
                );
              })}
          </div>

          {/* Removal is separated from repair on purpose: repair recovers data,
              this discards it. Only tracks the host answered 404/410 for are
              eligible — never a track that merely failed to load. */}
          {scan.missingSource > 0 && (
            <div className="p-3.5 rounded border border-error/30 bg-error/10 space-y-2.5">
              <div className="flex items-center gap-1.5 text-error text-[11px] font-bold">
                <AlertCircle size={13} />
                <span>
                  {scan.missingSource} {scan.missingSource === 1 ? 'track has' : 'tracks have'} no audio file
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-on-surface-variant">
                Their audio is gone from storage, so they can never play. Removing them deletes the
                catalogue entry only &mdash; the audio is already gone &mdash; and takes them out of any
                playlist that referenced them. <strong className="text-white">This cannot be undone.</strong>
                {scan.byDiagnosis['unreadable'] > 0 && (
                  <> Tracks that merely failed to load are not included.</>
                )}
              </p>

              {confirmRemoval ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-white">
                    Remove {scan.missingSource} {scan.missingSource === 1 ? 'entry' : 'entries'}?
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveMissing}
                    className="px-3 py-1.5 rounded bg-error text-white text-[11px] font-bold hover:brightness-110 transition"
                  >
                    Yes, remove
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRemoval(false)}
                    className="px-3 py-1.5 rounded bg-white/10 text-white text-[11px] font-bold hover:bg-white/20 transition"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmRemoval(true)}
                  className="px-3 py-1.5 rounded border border-error/50 text-error text-[11px] font-bold hover:bg-error/15 transition flex items-center gap-1.5"
                >
                  <Trash2 size={12} />
                  <span>Remove unavailable tracks</span>
                </button>
              )}
            </div>
          )}

          {scan.repairable === 0 ? (
            <div className="p-4 rounded bg-surface-container-high/40 border border-white/5 text-xs text-on-surface-variant leading-relaxed">
              <p className="font-bold text-white mb-1">Nothing to repair.</p>
              <p>See the breakdown above for why. Tracks with no embedded artwork show a cover generated from the track name, so each stays visually distinct.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="flex items-center gap-2.5 text-xs text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restoreArtwork}
                    onChange={e => setRestoreArtwork(e.target.checked)}
                    className="accent-primary w-4 h-4"
                  />
                  <ImageIcon size={14} className="text-primary" />
                  <span>
                    Restore embedded album art{' '}
                    <span className="text-on-surface-variant">
                      ({scan.results.filter(r => r.needsArt && r.hasEmbeddedArt).length} tracks)
                    </span>
                  </span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restoreMetadata}
                    onChange={e => setRestoreMetadata(e.target.checked)}
                    className="accent-primary w-4 h-4"
                  />
                  <Tag size={14} className="text-primary" />
                  <span>
                    Replace titles, artists and albums with the file&rsquo;s own tags{' '}
                    <span className="text-on-surface-variant">
                      ({scan.results.filter(r => r.proposedChanges.length > 0).length} tracks)
                    </span>
                  </span>
                </label>
                {scan.missingOwner > 0 && currentUser && (
                  <label className="flex items-center gap-2.5 text-xs text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={claimOwnership}
                      onChange={e => setClaimOwnership(e.target.checked)}
                      className="accent-primary w-4 h-4"
                    />
                    <ShieldCheck size={14} className="text-primary" />
                    <span>
                      Claim ownership of pre-existing tracks{' '}
                      <span className="text-on-surface-variant">
                        ({scan.missingOwner} tracks) &mdash; required before security rules are enforced
                      </span>
                    </span>
                  </label>
                )}
              </div>

              {/* Preview of proposed metadata changes */}
              {restoreMetadata && (
                <div className="max-h-44 overflow-y-auto rounded bg-black/30 border border-white/10 divide-y divide-white/5">
                  {scan.results
                    .filter(r => r.proposedChanges.length > 0)
                    .slice(0, 40)
                    .map(r => (
                      <div key={r.trackId} className="px-3 py-2 text-[11px]">
                        <div className="font-bold text-white truncate">{r.currentTitle}</div>
                        {r.proposedChanges.map(c => (
                          <div key={String(c.field)} className="text-on-surface-variant truncate">
                            <span className="uppercase tracking-wider text-[9px] mr-1.5">{String(c.field)}</span>
                            <span className="line-through opacity-60">{c.from}</span>
                            <span className="mx-1.5 text-primary">-&gt;</span>
                            <span className="text-white">{c.to}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {repair && (
        <div className="p-3.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs space-y-1">
          <div className="flex items-center gap-2 font-bold">
            <Check size={16} />
            <span>Repair complete</span>
          </div>
          <p>
            {repair.artworkRestored} cover{repair.artworkRestored === 1 ? '' : 's'} restored,{' '}
            {repair.metadataRestored} track{repair.metadataRestored === 1 ? '' : 's'} retagged
            {repair.ownershipClaimed > 0 && `, ${repair.ownershipClaimed} claimed`}.
            {repair.failed.length > 0 && ` ${repair.failed.length} failed.`}
          </p>
          <p className="text-emerald-300/70">Reload to see the updated library.</p>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={handleScan}
          disabled={busy}
          className="px-4 py-2 rounded bg-white/5 text-xs font-bold text-white hover:bg-white/10 disabled:opacity-40 flex items-center gap-1.5 transition-colors"
        >
          {phase === 'scanning' ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          <span>{scan ? 'Rescan library' : 'Scan library'}</span>
        </button>

        {scan && repairTargetCount > 0 && (
          <button
            type="button"
            onClick={handleRepair}
            /* Ownership counts as work. Leaving it out of this check disabled
               the button whenever artwork and metadata had no targets — which
               is exactly the state a library in the ownership migration is in,
               so the one repair that actually needed running was the one that
               could not be started, under a button still labelled with its
               own track count. */
            disabled={busy || (!restoreArtwork && !restoreMetadata && !claimOwnership)}
            className="px-5 py-2 rounded bg-primary hover:bg-primary-fixed text-on-primary text-xs font-bold disabled:opacity-40 flex items-center gap-1.5 transition-colors"
          >
            {phase === 'repairing' ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            <span>Repair {repairTargetCount} track{repairTargetCount === 1 ? '' : 's'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
