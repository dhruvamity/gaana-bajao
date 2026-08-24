import React, { useState } from 'react';
import { 
  X, 
  Trash2, 
  Sparkles, 
  Play, 
  Pause, 
  GripVertical, 
  Music2, 
  Radio, 
  ArrowUp, 
  ArrowDown,
  Clock,
  Activity
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { Track } from '../types';
import { CoverArt } from './CoverArt';

export const QueueDrawer: React.FC = () => {
  const { 
    isQueueOpen, 
    setIsQueueOpen, 
    queue, 
    currentTrack, 
    isPlaying, 
    playTrack, 
    removeFromQueue, 
    reorderQueue, 
    clearQueue 
  } = useAudio();

  const [autoPlayAlgorithmic, setAutoPlayAlgorithmic] = useState<boolean>(true);

  if (!isQueueOpen) return null;

  const currentIndex = queue.findIndex(t => t.id === currentTrack?.id);
  const upNextTracks = queue.filter((_, idx) => idx > currentIndex);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex justify-end animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md h-full glass-elevated border-l border-white/15 p-6 shadow-2xl flex flex-col justify-between overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary border border-primary/30 flex items-center justify-center">
                <Music2 size={16} />
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">Up Next Queue</h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={clearQueue}
                className="text-xs text-on-surface-variant hover:text-red-400 px-2 py-1 rounded-lg glass-subtle transition-colors flex items-center gap-1"
                title="Clear queue"
              >
                <Trash2 size={13} />
                <span>Clear</span>
              </button>
              <button
                onClick={() => setIsQueueOpen(false)}
                className="p-2 rounded-full glass-subtle text-on-surface-variant hover:text-white transition-all"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Autoplay Switch */}
          <div className="p-3 rounded-xl glass-subtle flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-primary" />
              <span className="text-xs font-semibold text-white">Autoplay Similar Music</span>
            </div>
            <button
              onClick={() => setAutoPlayAlgorithmic(!autoPlayAlgorithmic)}
              className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${
                autoPlayAlgorithmic ? 'bg-primary' : 'bg-white/20'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-background shadow-md transition-transform ${
                  autoPlayAlgorithmic ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Scrollable Queue List */}
        <div className="flex-1 overflow-y-auto space-y-6 my-4 pr-1">
          {/* Now Playing Section */}
          {currentTrack && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                <Radio size={12} className="animate-pulse" />
                Now Playing
              </span>

              <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/40 flex items-center justify-between gap-3">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-md flex-shrink-0">
                  <CoverArt src={currentTrack.coverUrl} title={currentTrack.title} artist={currentTrack.artist} id={currentTrack.id} className="w-full h-full object-cover" />
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-white truncate">{currentTrack.title}</h4>
                  <p className="text-xs text-primary font-medium truncate">{currentTrack.artist}</p>
                </div>

                <div className="text-xs text-primary font-semibold flex items-center gap-1">
                  <Activity size={13} />
                  <span>{formatDuration(currentTrack.duration)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Up Next List */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Next in Queue ({upNextTracks.length})
            </span>

            {upNextTracks.length === 0 ? (
              <div className="p-8 text-center glass-subtle rounded-2xl border border-white/5 space-y-1">
                <p className="text-xs font-medium text-white">Queue is empty</p>
                <p className="text-[11px] text-on-surface-variant">
                  Similar tracks will automatically play when the current track finishes.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {upNextTracks.map((track, idx) => {
                  const queueIndex = currentIndex + 1 + idx;

                  return (
                    <div
                      key={track.id + idx}
                      className="group p-2.5 rounded-2xl glass-panel border border-white/5 hover:border-primary/30 flex items-center justify-between gap-3 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                          <CoverArt src={track.coverUrl} title={track.title} artist={track.artist} id={track.id} className="w-full h-full object-cover" />
                          <button
                            onClick={() => playTrack(track, queue)}
                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Play size={14} fill="#ffffff" className="ml-0.5" />
                          </button>
                        </div>

                        <div className="min-w-0">
                          <h5 className="text-xs font-bold text-white truncate group-hover:text-primary transition-colors">
                            {track.title}
                          </h5>
                          <p className="text-[11px] text-on-surface-variant truncate">{track.artist}</p>
                          {track.recommendationReason && (
                            <span className="text-[9px] text-primary/80 font-medium truncate block">
                              {track.recommendationReason}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Reorder Buttons */}
                        {idx > 0 && (
                          <button
                            onClick={() => reorderQueue(queueIndex, queueIndex - 1)}
                            className="p-1 text-on-surface-variant hover:text-white"
                            title="Move Up"
                          >
                            <ArrowUp size={13} />
                          </button>
                        )}
                        {idx < upNextTracks.length - 1 && (
                          <button
                            onClick={() => reorderQueue(queueIndex, queueIndex + 1)}
                            className="p-1 text-on-surface-variant hover:text-white"
                            title="Move Down"
                          >
                            <ArrowDown size={13} />
                          </button>
                        )}

                        <button
                          onClick={() => removeFromQueue(queueIndex)}
                          className="p-1.5 text-on-surface-variant hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove from queue"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-3 border-t border-white/10 text-center text-[11px] text-on-surface-variant">
          Personalized queue based on your taste profile
        </div>
      </div>
    </div>
  );
};
