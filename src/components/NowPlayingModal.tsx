import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronDown, 
  Heart, 
  Share2, 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Shuffle, 
  Repeat, 
  Volume2, 
  ListMusic, 
  Cast, 
  Sparkles, 
  Activity, 
  Music2, 
  Radio, 
  ShieldCheck, 
  Plus,
  FolderPlus 
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { Track } from '../types';
import { Scrubber } from './Scrubber';
import { CoverArt } from './CoverArt';

interface NowPlayingModalProps {
  onSelectArtist?: (artistId: string) => void;
  onOpenAddToPlaylist?: (track: Track) => void;
}

export const NowPlayingModal: React.FC<NowPlayingModalProps> = ({
  onSelectArtist,
  onOpenAddToPlaylist
}) => {
  const { 
    currentTrack, 
    isPlaying, 
    progress, 
    duration, 
    volume, 
    isShuffle, 
    isRepeat, 
    isNowPlayingOpen, 
    getFrequencyData,
    enableAnalyser,
    togglePlay, 
    nextTrack, 
    prevTrack, 
    seek, 
    setVolume, 
    toggleShuffle, 
    toggleRepeat, 
    setIsNowPlayingOpen,
    setIsQueueOpen,
    setIsConnectOpen,
    logInteraction
  } = useAudio();

  const { currentUser, toggleLikeTrack } = useAuth();
  const [activeTab, setActiveTab] = useState<'visualizer' | 'acoustics' | 'lyrics'>('visualizer');
  const [copiedShare, setCopiedShare] = useState(false);

  if (!isNowPlayingOpen || !currentTrack) return null;

  const isLiked = Boolean(currentUser?.likedTrackIds?.includes(currentTrack.id));
  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
  const isPast30s = progress >= 30;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleShare = () => {
    logInteraction('share', currentTrack.id);
    navigator.clipboard?.writeText(window.location.href);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  const handleLike = () => {
    toggleLikeTrack(currentTrack.id);
    logInteraction(isLiked ? 'unlike' : 'like', currentTrack.id);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background flex flex-col justify-between p-4 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
      {/* Dynamic Ambient Background Blur */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none filter blur-[100px] transition-all duration-1000"
        style={{
          backgroundImage:
            `radial-gradient(circle at 50% 30%, ${
              currentTrack.acoustics.energy > 0.7 ? '#1ed760' : '#3f6f52'
            } 0%, transparent 60%)`
        }}
      />

      {/* Top Bar Header */}
      <header className="relative z-10 flex items-center justify-between max-w-4xl mx-auto w-full">
        <button
          onClick={() => setIsNowPlayingOpen(false)}
          className="p-3 rounded-full bg-white/5 text-on-surface-variant hover:text-white transition-all"
        >
          <ChevronDown size={24} />
        </button>

        <div className="text-center">
          <span className="text-[11px] font-semibold text-primary uppercase tracking-widest flex items-center justify-center gap-1.5">
            <Radio size={13} className="animate-pulse" />
            Now Playing
          </span>
          <h3 className="text-sm font-semibold text-white truncate max-w-xs">{currentTrack.album}</h3>
        </div>

        <button
          onClick={handleShare}
          className="p-3 rounded-full bg-white/5 text-on-surface-variant hover:text-primary transition-all relative"
          title="Share"
        >
          <Share2 size={20} />
          {copiedShare && (
            <span className="absolute -bottom-8 right-0 bg-primary text-on-primary px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap shadow-lg">
              Link Copied!
            </span>
          )}
        </button>
      </header>

      {/* Center Section: Album Art & Visualizer / Tabs */}
      <main className="relative z-10 max-w-lg mx-auto w-full my-auto py-6 flex flex-col items-center">
        {/* Album Artwork Card */}
        <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-lg overflow-hidden bg-surface-container-high p-2 shadow-card group">
          <CoverArt
            src={currentTrack.coverUrl}
            title={currentTrack.title}
            artist={currentTrack.artist}
            id={currentTrack.id}
            loading="eager"
            className={`w-full h-full object-cover rounded-lg transition-transform duration-1000 ${isPlaying ? 'scale-105' : 'scale-100'}`}
          />
          {/* Subtle live acoustic badge */}
          <div className="absolute top-4 left-4 bg-surface-container px-2.5 py-1 rounded-full text-[10px] font-bold text-primary flex items-center gap-1">
            <Activity size={12} />
            <span>{currentTrack.acoustics.tempo} BPM • {currentTrack.acoustics.key || '44.1kHz'}</span>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1 bg-surface-container/70 p-1 rounded-full border border-white/10 mt-6">
          <button
            onClick={() => setActiveTab('visualizer')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'visualizer' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:text-white'
            }`}
          >
            Waveform
          </button>
          <button
            onClick={() => setActiveTab('acoustics')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'acoustics' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:text-white'
            }`}
          >
            Audio Profile
          </button>
          <button
            onClick={() => setActiveTab('lyrics')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'lyrics' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:text-white'
            }`}
          >
            Genre & Tags
          </button>
        </div>

        {/* Tab Content Display */}
        <div className="w-full h-24 mt-4 flex items-center justify-center">
          {activeTab === 'visualizer' && (
            <Visualizer getFrequencyData={getFrequencyData} enableAnalyser={enableAnalyser} isPlaying={isPlaying} />
          )}

          {activeTab === 'acoustics' && (
            <div className="grid grid-cols-4 gap-2 w-full px-4 text-center">
              <div className="bg-white/5 p-2 rounded">
                <div className="text-[10px] text-on-surface-variant">Energy</div>
                <div className="text-sm font-bold text-primary">{Math.round(currentTrack.acoustics.energy * 100)}%</div>
              </div>
              <div className="bg-white/5 p-2 rounded">
                <div className="text-[10px] text-on-surface-variant">Valence</div>
                <div className="text-sm font-bold text-tertiary">{Math.round(currentTrack.acoustics.valence * 100)}%</div>
              </div>
              <div className="bg-white/5 p-2 rounded">
                <div className="text-[10px] text-on-surface-variant">Danceability</div>
                <div className="text-sm font-bold text-secondary">{Math.round(currentTrack.acoustics.danceability * 100)}%</div>
              </div>
              <div className="bg-white/5 p-2 rounded">
                <div className="text-[10px] text-on-surface-variant">Acoustic</div>
                <div className="text-sm font-bold text-primary-fixed">{Math.round(currentTrack.acoustics.acousticness * 100)}%</div>
              </div>
            </div>
          )}

          {activeTab === 'lyrics' && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 px-4 text-center">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/20 text-primary border border-white/10">
                {currentTrack.genre}
              </span>
              {currentTrack.tags.map(tag => (
                <span key={tag} className="px-2.5 py-1 rounded-full text-xs bg-white/5 text-on-surface-variant border border-white/10">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Track Title, Artist, & Rationale */}
        <div className="w-full flex items-center justify-between mt-2 px-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
              {currentTrack.title}
            </h2>
            <p 
              onClick={() => {
                if (currentTrack.artistId && onSelectArtist) {
                  setIsNowPlayingOpen(false);
                  onSelectArtist(currentTrack.artistId);
                }
              }}
              className="text-sm text-on-surface-variant hover:text-white cursor-pointer transition-colors font-medium truncate mt-0.5"
            >
              {currentTrack.artist}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onOpenAddToPlaylist && (
              <button
                onClick={() => onOpenAddToPlaylist(currentTrack)}
                className="p-3 rounded-full bg-white/5 text-on-surface-variant hover:text-white transition-all"
                title="Add to Playlist"
              >
                <FolderPlus size={22} />
              </button>
            )}
            <button
              onClick={handleLike}
              className={`p-3 rounded-full bg-white/5 transition-all ${
                isLiked ? 'text-primary scale-110' : 'text-on-surface-variant hover:text-white'
              }`}
              title={isLiked ? 'Unlike' : 'Like'}
            >
              <Heart size={22} fill={isLiked ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

        {/* Recommendation Reason Pill */}
        {currentTrack.recommendationReason && (
          <div className="w-full mt-3 px-3.5 py-2 rounded bg-primary/10 border border-white/10 flex items-center gap-2 text-xs text-primary font-medium">
            <Sparkles size={14} className="flex-shrink-0" />
            <span className="truncate">{currentTrack.recommendationReason}</span>
          </div>
        )}
      </main>

      {/* Bottom Controls Section */}
      <footer className="relative z-10 max-w-lg mx-auto w-full space-y-4">
        {/* Timeline Scrubber */}
        <div className="space-y-1.5">
          <Scrubber
            value={progress}
            max={duration}
            onSeek={seek}
            label="Seek"
            formatValue={(v) => `${formatTime(v)} of ${formatTime(duration)}`}
            size="md"
          />

          <div className="flex items-center justify-between text-xs text-on-surface-variant font-medium">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Main Controls Row */}
        <div className="flex items-center justify-between py-2">
          <button
            onClick={toggleShuffle}
            className={`p-3 rounded-full transition-all ${
              isShuffle ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:text-white'
            }`}
            title="Shuffle"
          >
            <Shuffle size={20} />
          </button>

          <button
            onClick={prevTrack}
            className="p-3 text-on-surface-variant hover:text-white transition-colors"
            title="Previous track"
          >
            <SkipBack size={26} />
          </button>

          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-primary hover:bg-primary-fixed text-on-primary flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
          </button>

          <button
            onClick={nextTrack}
            className="p-3 text-on-surface-variant hover:text-white transition-colors"
            title="Next track (Skip)"
          >
            <SkipForward size={26} />
          </button>

          <button
            onClick={toggleRepeat}
            className={`p-3 rounded-full transition-all ${
              isRepeat ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:text-white'
            }`}
            title="Repeat"
          >
            <Repeat size={20} />
          </button>
        </div>

        {/* Bottom Utility Row */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          {/* Connect Devices */}
          <button
            onClick={() => setIsConnectOpen(true)}
            className="flex items-center gap-2 text-xs font-semibold text-primary hover:text-white transition-colors"
          >
            <Cast size={18} />
            <span>Connect & Handoff</span>
          </button>

          {/* Up Next Queue */}
          <button
            onClick={() => {
              setIsNowPlayingOpen(false);
              setIsQueueOpen(true);
            }}
            className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant hover:text-white transition-colors"
          >
            <ListMusic size={18} />
            <span>Up Next Queue</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

const VISUALIZER_BARS = 28;

/**
 * Spectrum bars driven by their own animation frame.
 *
 * Bar heights are written straight to the DOM rather than held in React state:
 * at 60fps a state update here re-rendered every consumer of the audio context
 * across the whole app. The loop runs only while this component is mounted and
 * audio is playing, and pauses itself when the tab is hidden.
 */
const Visualizer: React.FC<{
  getFrequencyData: () => Uint8Array;
  enableAnalyser: () => Promise<boolean>;
  isPlaying: boolean;
}> = ({ getFrequencyData, enableAnalyser, isPlaying }) => {
  const barsRef = useRef<Array<HTMLDivElement | null>>([]);
  const [analyserLive, setAnalyserLive] = useState<boolean | null>(null);

  // Request the analyser only while this component is mounted and playing.
  // enableAnalyser resolves false when attaching it would silence the audio.
  useEffect(() => {
    if (!isPlaying) return;
    let cancelled = false;
    void enableAnalyser().then(ok => {
      if (!cancelled) setAnalyserLive(ok);
    });
    return () => { cancelled = true; };
  }, [isPlaying, enableAnalyser]);
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const bars = barsRef.current;

    if (!isPlaying || prefersReducedMotion || analyserLive !== true) {
      bars.forEach(bar => {
        if (bar) bar.style.height = '15%';
      });
      return;
    }

    let frame = 0;
    const tick = () => {
      const data = getFrequencyData();
      for (let i = 0; i < bars.length; i++) {
        const bar = bars[i];
        if (!bar) continue;
        const value = data[i * 2] || 15;
        bar.style.height = `${Math.max(12, (value / 255) * 100)}%`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [isPlaying, getFrequencyData, prefersReducedMotion, analyserLive]);

  return (
    <div className="w-full">
      <div className="flex items-end justify-center gap-1 h-16 w-full px-8" aria-hidden="true">
        {Array.from({ length: VISUALIZER_BARS }).map((_, i) => (
          <div
            key={i}
            ref={el => { barsRef.current[i] = el; }}
            className={`flex-1 rounded-full transition-colors ${
              analyserLive === false
                ? 'bg-white/10'
                : 'bg-gradient-to-t from-primary/40 to-primary'
            }`}
            style={{ height: '15%' }}
          />
        ))}
      </div>
      {analyserLive === false && (
        <p className="text-center text-[10px] text-on-surface-variant mt-2 px-6">
          Spectrum view is unavailable for this source, so playback stays audible.
        </p>
      )}
    </div>
  );
};
