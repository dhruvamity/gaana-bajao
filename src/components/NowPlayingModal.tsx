import React, { useState } from 'react';
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
    frequencyData,
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background/95 backdrop-blur-3xl flex flex-col justify-between p-4 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
      {/* Dynamic Ambient Background Blur */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none filter blur-[100px] transition-all duration-1000"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 30%, ${currentTrack.acoustics.energy > 0.7 ? '#7dd3fc' : '#c8a0f0'} 0%, transparent 60%)`
        }}
      />

      {/* Top Bar Header */}
      <header className="relative z-10 flex items-center justify-between max-w-4xl mx-auto w-full">
        <button
          onClick={() => setIsNowPlayingOpen(false)}
          className="p-3 rounded-full glass-subtle text-on-surface-variant hover:text-white transition-all"
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
          className="p-3 rounded-full glass-subtle text-on-surface-variant hover:text-primary transition-all relative"
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
        <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-3xl overflow-hidden glass-elevated border border-white/15 p-2 shadow-2xl group">
          <img
            src={currentTrack.coverUrl}
            alt={currentTrack.title}
            className={`w-full h-full object-cover rounded-2xl transition-transform duration-1000 ${isPlaying ? 'scale-105' : 'scale-100'}`}
          />
          {/* Subtle live acoustic badge */}
          <div className="absolute top-4 left-4 glass-panel px-2.5 py-1 rounded-full text-[10px] font-bold text-primary flex items-center gap-1">
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
            <div className="flex items-end justify-center gap-1 h-16 w-full px-8">
              {Array.from({ length: 28 }).map((_, i) => {
                const val = frequencyData[i * 2] || 15;
                const heightPercent = Math.max(12, (val / 255) * 100);
                return (
                  <div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-primary/40 to-primary rounded-full transition-all duration-75"
                    style={{ height: isPlaying ? `${heightPercent}%` : '15%' }}
                  />
                );
              })}
            </div>
          )}

          {activeTab === 'acoustics' && (
            <div className="grid grid-cols-4 gap-2 w-full px-4 text-center">
              <div className="glass-subtle p-2 rounded-xl">
                <div className="text-[10px] text-on-surface-variant">Energy</div>
                <div className="text-sm font-bold text-primary">{Math.round(currentTrack.acoustics.energy * 100)}%</div>
              </div>
              <div className="glass-subtle p-2 rounded-xl">
                <div className="text-[10px] text-on-surface-variant">Valence</div>
                <div className="text-sm font-bold text-tertiary">{Math.round(currentTrack.acoustics.valence * 100)}%</div>
              </div>
              <div className="glass-subtle p-2 rounded-xl">
                <div className="text-[10px] text-on-surface-variant">Danceability</div>
                <div className="text-sm font-bold text-secondary">{Math.round(currentTrack.acoustics.danceability * 100)}%</div>
              </div>
              <div className="glass-subtle p-2 rounded-xl">
                <div className="text-[10px] text-on-surface-variant">Acoustic</div>
                <div className="text-sm font-bold text-primary-fixed">{Math.round(currentTrack.acoustics.acousticness * 100)}%</div>
              </div>
            </div>
          )}

          {activeTab === 'lyrics' && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 px-4 text-center">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/20 text-primary border border-primary/30">
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
                className="p-3 rounded-full glass-subtle text-on-surface-variant hover:text-white transition-all"
                title="Add to Playlist"
              >
                <FolderPlus size={22} />
              </button>
            )}
            <button
              onClick={handleLike}
              className={`p-3 rounded-full glass-subtle transition-all ${
                isLiked ? 'text-primary scale-110' : 'text-on-surface-variant hover:text-white'
              }`}
              title={isLiked ? 'Unlike' : 'Like'}
            >
              <Heart size={22} fill={isLiked ? '#7dd3fc' : 'none'} />
            </button>
          </div>
        </div>

        {/* Recommendation Reason Pill */}
        {currentTrack.recommendationReason && (
          <div className="w-full mt-3 px-3.5 py-2 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-2 text-xs text-primary font-medium">
            <Sparkles size={14} className="flex-shrink-0" />
            <span className="truncate">{currentTrack.recommendationReason}</span>
          </div>
        )}
      </main>

      {/* Bottom Controls Section */}
      <footer className="relative z-10 max-w-lg mx-auto w-full space-y-4">
        {/* Timeline Scrubber */}
        <div className="space-y-1.5">
          <div
            className="relative w-full h-2 bg-white/10 hover:h-3 rounded-full cursor-pointer transition-all group overflow-hidden"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pos = (e.clientX - rect.left) / rect.width;
              seek(pos * duration);
            }}
          >
            <div
              className="h-full bg-gradient-to-r from-primary to-primary-fixed rounded-full relative"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

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
            className="w-16 h-16 rounded-full bg-primary hover:bg-primary-fixed text-on-primary flex items-center justify-center shadow-xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={28} fill="#001f2e" /> : <Play size={28} fill="#001f2e" className="ml-1" />}
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
