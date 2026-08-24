import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX,
  Volume1,
  Maximize2, 
  Heart, 
  Shuffle, 
  Repeat, 
  ListMusic, 
  Cast, 
  Mic2,
  PanelRight,
  FolderPlus,
  Radio
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { Track } from '../types';

interface MiniPlayerProps {
  onSelectArtist?: (artistId: string) => void;
  onOpenAddToPlaylist?: (track: Track) => void;
  isRightSidebarOpen?: boolean;
  onToggleRightSidebar?: () => void;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  onSelectArtist,
  onOpenAddToPlaylist,
  isRightSidebarOpen,
  onToggleRightSidebar
}) => {
  const { 
    currentTrack, 
    isPlaying, 
    progress, 
    duration, 
    volume, 
    isShuffle,
    isRepeat,
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
  const [previousVolume, setPreviousVolume] = useState<number>(0.8);

  if (!currentTrack) return null;

  const isLiked = Boolean(currentUser?.likedTrackIds?.includes(currentTrack.id));
  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleLikeTrack(currentTrack.id);
    logInteraction(isLiked ? 'unlike' : 'like', currentTrack.id);
  };

  const handleToggleMute = () => {
    if (volume > 0) {
      setPreviousVolume(volume);
      setVolume(0);
    } else {
      setVolume(previousVolume || 0.8);
    }
  };

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 bg-surface-container-lowest/95 backdrop-blur-2xl border-t border-white/10 px-4 py-2.5 select-none h-22 flex items-center justify-between transition-all">
      {/* 1. Left Section: Now Playing Artwork & Meta */}
      <div className="flex items-center gap-3.5 min-w-0 w-1/4 max-w-xs">
        <div 
          onClick={() => setIsNowPlayingOpen(true)}
          className="relative w-14 h-14 rounded-xl overflow-hidden shadow-lg flex-shrink-0 cursor-pointer group ring-1 ring-white/10"
        >
          <img 
            src={currentTrack.coverUrl} 
            alt={currentTrack.title} 
            className={`w-full h-full object-cover transition-transform duration-700 ${isPlaying ? 'scale-105' : 'scale-100'}`}
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Maximize2 size={16} className="text-white" />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h4 
            onClick={() => setIsNowPlayingOpen(true)}
            className="text-sm font-bold text-white truncate hover:underline cursor-pointer tracking-tight"
          >
            {currentTrack.title}
          </h4>
          <p 
            onClick={(e) => {
              e.stopPropagation();
              if (currentTrack.artistId && onSelectArtist) {
                onSelectArtist(currentTrack.artistId);
              }
            }}
            className="text-xs text-on-surface-variant hover:text-white hover:underline cursor-pointer transition-colors truncate mt-0.5"
          >
            {currentTrack.artist}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {onOpenAddToPlaylist && (
            <button
              onClick={() => onOpenAddToPlaylist(currentTrack)}
              className="p-1.5 rounded-full text-on-surface-variant hover:text-white transition-all hidden xl:block"
              title="Add to playlist"
            >
              <FolderPlus size={16} />
            </button>
          )}

          <button
            onClick={handleLike}
            className={`p-1.5 rounded-full transition-all ${
              isLiked ? 'text-primary scale-110' : 'text-on-surface-variant hover:text-white'
            }`}
            title={isLiked ? 'Unlike' : 'Like'}
          >
            <Heart size={18} fill={isLiked ? '#7dd3fc' : 'none'} />
          </button>
        </div>
      </div>

      {/* 2. Center Section: Playback Controls & Timeline Scrubber */}
      <div className="flex flex-col items-center gap-1.5 w-2/4 max-w-2xl px-2 sm:px-6">
        {/* Playback Buttons */}
        <div className="flex items-center gap-4 sm:gap-6">
          <button 
            onClick={toggleShuffle}
            className={`p-1.5 transition-colors relative ${
              isShuffle ? 'text-primary' : 'text-on-surface-variant hover:text-white'
            }`}
            title={isShuffle ? 'Disable Shuffle' : 'Enable Shuffle'}
          >
            <Shuffle size={16} />
            {isShuffle && <span className="w-1 h-1 rounded-full bg-primary absolute bottom-0 left-1/2 -translate-x-1/2"></span>}
          </button>

          <button 
            onClick={prevTrack}
            className="p-1.5 text-on-surface-variant hover:text-white transition-colors"
            title="Previous"
          >
            <SkipBack size={18} />
          </button>

          <button 
            onClick={togglePlay}
            className="w-9 h-9 rounded-full bg-white hover:scale-105 active:scale-95 text-black flex items-center justify-center shadow-lg transition-transform"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause size={18} fill="#000000" />
            ) : (
              <Play size={18} fill="#000000" className="ml-0.5" />
            )}
          </button>

          <button 
            onClick={nextTrack}
            className="p-1.5 text-on-surface-variant hover:text-white transition-colors"
            title="Next"
          >
            <SkipForward size={18} />
          </button>

          <button 
            onClick={toggleRepeat}
            className={`p-1.5 transition-colors relative ${
              isRepeat ? 'text-primary' : 'text-on-surface-variant hover:text-white'
            }`}
            title={isRepeat ? 'Disable Repeat' : 'Enable Repeat'}
          >
            <Repeat size={16} />
            {isRepeat && <span className="w-1 h-1 rounded-full bg-primary absolute bottom-0 left-1/2 -translate-x-1/2"></span>}
          </button>
        </div>

        {/* Timeline Scrubber */}
        <div className="w-full flex items-center gap-2.5">
          <span className="text-[11px] text-on-surface-variant font-mono w-8 text-right">
            {formatTime(progress)}
          </span>

          <div
            className="relative flex-1 h-1 hover:h-2 bg-white/15 rounded-full cursor-pointer transition-all group overflow-hidden"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pos = (e.clientX - rect.left) / rect.width;
              seek(pos * duration);
            }}
          >
            <div
              className="h-full bg-white group-hover:bg-primary rounded-full relative transition-colors"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <span className="text-[11px] text-on-surface-variant font-mono w-8">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* 3. Right Section: Additional View Toggles & Volume */}
      <div className="flex items-center justify-end gap-2.5 w-1/4 max-w-xs">
        {onToggleRightSidebar && (
          <button
            onClick={onToggleRightSidebar}
            className={`p-2 rounded-xl transition-all hidden lg:block ${
              isRightSidebarOpen ? 'text-primary bg-white/10' : 'text-on-surface-variant hover:text-white hover:bg-white/5'
            }`}
            title="Now playing view"
          >
            <PanelRight size={17} />
          </button>
        )}

        <button
          onClick={() => setIsQueueOpen(true)}
          className="p-2 rounded-xl text-on-surface-variant hover:text-white hover:bg-white/5 transition-all"
          title="Queue"
        >
          <ListMusic size={18} />
        </button>

        <button
          onClick={() => setIsConnectOpen(true)}
          className="p-2 rounded-xl text-on-surface-variant hover:text-primary hover:bg-white/5 transition-all"
          title="Connect to a device"
        >
          <Cast size={17} />
        </button>

        {/* Volume Controls */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={handleToggleMute}
            className="p-1.5 text-on-surface-variant hover:text-white transition-colors"
            title={volume === 0 ? 'Unmute' : 'Mute'}
          >
            {volume === 0 ? <VolumeX size={17} /> : volume < 0.5 ? <Volume1 size={17} /> : <Volume2 size={17} />}
          </button>

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-18 lg:w-24 h-1 bg-white/20 hover:bg-white/30 rounded-lg cursor-pointer accent-primary"
          />
        </div>

        <button
          onClick={() => setIsNowPlayingOpen(true)}
          className="p-2 rounded-xl text-on-surface-variant hover:text-white hover:bg-white/5 transition-all hidden sm:block"
          title="Full screen"
        >
          <Maximize2 size={16} />
        </button>
      </div>
    </footer>
  );
};
