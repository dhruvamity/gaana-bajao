import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Wand2, Search, AlertCircle, Check, Image as ImageIcon, Tag, Loader2, ShieldCheck, Info } from 'lucide-react';
import {
  scanLibrary,
  repairLibrary,
  ScanSummary,
  RepairSummary
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
  'unreadable': {
    label: 'Could not read the file',
    detail: 'The audio could not be fetched or parsed. Usually a CORS restriction or an expired media URL.',
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
  const [error, setError] = useState<string | null>(null);

  const [restoreArtwork, setRestoreArtwork] = useState(true);
  const [restoreMetadata, setRestoreMetadata] = useState(true);
  const [claimOwnership, setClaimOwnership] = useState(true);

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

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const busy = phase === 'scanning' || phase === 'repairing';

  return (
    <div className="space-y-4">
      <div className="p-3.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary font-medium flex items-start gap-2">
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
          className="px-4 py-2 rounded glass-subtle text-xs font-bold text-white hover:bg-white/10 disabled:opacity-40 flex items-center gap-1.5 transition-colors"
        >
          {phase === 'scanning' ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          <span>{scan ? 'Rescan library' : 'Scan library'}</span>
        </button>

        {scan && scan.repairable > 0 && (
          <button
            type="button"
            onClick={handleRepair}
            disabled={busy || (!restoreArtwork && !restoreMetadata)}
            className="px-5 py-2 rounded bg-primary hover:bg-primary-fixed text-on-primary text-xs font-bold disabled:opacity-40 flex items-center gap-1.5 transition-colors"
          >
            {phase === 'repairing' ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            <span>Repair {scan.repairable} track{scan.repairable === 1 ? '' : 's'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
