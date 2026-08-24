import React, { useState } from 'react';
import { Wand2, Search, AlertCircle, Check, Image as ImageIcon, Tag, Loader2 } from 'lucide-react';
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
export const LibraryRepairPanel: React.FC = () => {
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'scanned' | 'repairing' | 'done'>('idle');
  const [progress, setProgress] = useState<{ done: number; total: number; label?: string }>({ done: 0, total: 0 });
  const [scan, setScan] = useState<ScanSummary | null>(null);
  const [repair, setRepair] = useState<RepairSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [restoreArtwork, setRestoreArtwork] = useState(true);
  const [restoreMetadata, setRestoreMetadata] = useState(true);

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
        { restoreArtwork, restoreMetadata },
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
      <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 text-xs text-primary font-medium flex items-start gap-2">
        <Wand2 size={16} className="flex-shrink-0 mt-0.5" />
        <span>
          Re-reads the ID3 tags inside your uploaded audio files to recover album art, titles and
          artist names that were missed at upload. Scanning only reads the first few kilobytes of
          each file and changes nothing.
        </span>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-error/15 border border-error/30 text-error text-xs flex items-center gap-2">
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
              <div key={stat.label} className="p-3 rounded-xl bg-surface-container-high/60 border border-white/5">
                <div className="text-lg font-black text-white tabular-nums">{stat.value}</div>
                <div className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {scan.repairable === 0 ? (
            <div className="p-4 rounded-xl bg-surface-container-high/40 border border-white/5 text-xs text-on-surface-variant leading-relaxed">
              <p className="font-bold text-white mb-1">Nothing to recover.</p>
              <p>
                {scan.withEmbeddedArt === 0 && scan.withTags === 0
                  ? 'None of your audio files carry ID3 tags or embedded artwork — there is no artwork stored inside them to extract. Tracks without artwork now show a cover generated from the track name, so each one is still visually distinct.'
                  : 'Every track already has the artwork and metadata its file contains.'}
              </p>
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
              </div>

              {/* Preview of proposed metadata changes */}
              {restoreMetadata && (
                <div className="max-h-44 overflow-y-auto rounded-xl bg-black/30 border border-white/10 divide-y divide-white/5">
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
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs space-y-1">
          <div className="flex items-center gap-2 font-bold">
            <Check size={16} />
            <span>Repair complete</span>
          </div>
          <p>
            {repair.artworkRestored} cover{repair.artworkRestored === 1 ? '' : 's'} restored,{' '}
            {repair.metadataRestored} track{repair.metadataRestored === 1 ? '' : 's'} retagged.
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
          className="px-4 py-2 rounded-xl glass-subtle text-xs font-bold text-white hover:bg-white/10 disabled:opacity-40 flex items-center gap-1.5 transition-colors"
        >
          {phase === 'scanning' ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          <span>{scan ? 'Rescan library' : 'Scan library'}</span>
        </button>

        {scan && scan.repairable > 0 && (
          <button
            type="button"
            onClick={handleRepair}
            disabled={busy || (!restoreArtwork && !restoreMetadata)}
            className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-fixed text-on-primary text-xs font-bold disabled:opacity-40 flex items-center gap-1.5 transition-colors"
          >
            {phase === 'repairing' ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            <span>Repair {scan.repairable} track{scan.repairable === 1 ? '' : 's'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
