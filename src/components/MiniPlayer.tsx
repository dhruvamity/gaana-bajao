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
import { Scrubber } from './Scrubber';
import { CoverArt } from './CoverArt';

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
    <footer className="w-full z-50 bg-background px-4 select-none h-22 flex items-center justify-between gap-4 flex-shrink-0">
      {/* 1. Left Section: Now Playing Artwork & Meta */}
      <div className="flex items-center gap-3.5 min-w-0 w-1/4 max-w-xs">
        <div 
          onClick={() => setIsNowPlayingOpen(true)}
          className="relative w-14 h-14 rounded overflow-hidden flex-shrink-0 cursor-pointer group"
        >
          <CoverArt
            src={currentTrack.coverUrl}
            title={currentTrack.title}
            artist={currentTrack.artist}
            id={currentTrack.id}
            loading="eager"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Maximize2 size={16} className="text-white" />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setIsNowPlayingOpen(true)}
            className="block max-w-full text-sm text-white truncate hover:underline text-left"
          >
            {currentTrack.title}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (currentTrack.artistId && onSelectArtist) {
                onSelectArtist(currentTrack.artistId);
              }
            }}
            className="block max-w-full text-2xs text-on-surface-variant hover:text-white hover:underline transition-colors truncate text-left"
          >
            {currentTrack.artist}
          </button>
        </div>

        <div className="flex items-center gap-1">
          {onOpenAddToPlaylist && (
            <button
              onClick={() => onOpenAddToPlaylist(currentTrack)}
              className="p-1.5 rounded-full text-on-surface-variant hover:text-white transition-colors hidden xl:block"
              title="Add to playlist"
              aria-label="Add to playlist"
            >
              <FolderPlus size={16} />
            </button>
          )}

          <button
            onClick={handleLike}
            className={`p-1.5 rounded-full transition-colors ${
              isLiked ? 'text-primary' : 'text-on-surface-variant hover:text-white'
            }`}
            title={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
            aria-label={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
            aria-pressed={isLiked}
          >
            <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      {/* 2. Center Section: Playback Controls & Timeline Scrubber */}
      <div className="flex flex-col items-center gap-2 flex-1 max-w-[722px] px-2">
        {/* Playback Buttons */}
        <div className="flex items-center gap-4 sm:gap-6">
          <button 
            onClick={toggleShuffle}
            className={`p-1.5 transition-colors relative ${
              isShuffle ? 'text-primary' : 'text-on-surface-variant hover:text-white'
            }`}
            title={isShuffle ? 'Disable shuffle' : 'Enable shuffle'}
            aria-label={isShuffle ? 'Disable shuffle' : 'Enable shuffle'}
            aria-pressed={isShuffle}
          >
            <Shuffle size={16} />
            {isShuffle && <span className="w-1 h-1 rounded-full bg-primary absolute -bottom-0.5 left-1/2 -translate-x-1/2"></span>}
          </button>

          <button 
            onClick={prevTrack}
            className="p-1.5 text-on-surface-variant hover:text-white transition-colors"
            title="Previous"
            aria-label="Previous track"
          >
            <SkipBack size={18} fill="currentColor" />
          </button>

          <button 
            onClick={togglePlay}
            className="w-8 h-8 rounded-full bg-white hover:scale-105 active:scale-100 text-black flex items-center justify-center transition-transform"
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause size={16} fill="currentColor" />
            ) : (
              <Play size={16} fill="currentColor" className="ml-0.5" />
            )}
          </button>

          <button 
            onClick={nextTrack}
            className="p-1.5 text-on-surface-variant hover:text-white transition-colors"
            title="Next"
            aria-label="Next track"
          >
            <SkipForward size={18} fill="currentColor" />
          </button>

          <button 
            onClick={toggleRepeat}
            className={`p-1.5 transition-colors relative ${
              isRepeat ? 'text-primary' : 'text-on-surface-variant hover:text-white'
            }`}
            title={isRepeat ? 'Disable repeat' : 'Enable repeat'}
            aria-label={isRepeat ? 'Disable repeat' : 'Enable repeat'}
            aria-pressed={isRepeat}
          >
            <Repeat size={16} />
            {isRepeat && <span className="w-1 h-1 rounded-full bg-primary absolute -bottom-0.5 left-1/2 -translate-x-1/2"></span>}
          </button>
        </div>

        {/* Timeline Scrubber */}
        <div className="w-full flex items-center gap-2.5">
          <span className="text-2xs text-on-surface-variant tabular-nums w-10 text-right">
            {formatTime(progress)}
          </span>

          <Scrubber
            value={progress}
            max={duration}
            onSeek={seek}
            label="Seek"
            formatValue={(v) => `${formatTime(v)} of ${formatTime(duration)}`}
            className="flex-1"
          />

          <span className="text-2xs text-on-surface-variant tabular-nums w-10">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* 3. Right Section: Additional View Toggles & Volume */}
      <div className="flex items-center justify-end gap-2 w-[30%] min-w-[180px]">
        {onToggleRightSidebar && (
          <button
            onClick={onToggleRightSidebar}
            className={`p-2 rounded transition-colors hidden lg:block relative ${
              isRightSidebarOpen ? 'text-primary' : 'text-on-surface-variant hover:text-white'
            }`}
            title="Now playing view"
            aria-label="Toggle now playing view"
            aria-pressed={isRightSidebarOpen}
          >
            <PanelRight size={18} />
          </button>
        )}

        <button
          onClick={() => setIsQueueOpen(true)}
          className="p-2 rounded text-on-surface-variant hover:text-white transition-colors"
          title="Queue"
          aria-label="Open queue"
        >
          <ListMusic size={18} />
        </button>

        <button
          onClick={() => setIsConnectOpen(true)}
          className="p-2 rounded text-on-surface-variant hover:text-white transition-colors"
          title="Connect to a device"
          aria-label="Connect to a device"
        >
          <Cast size={18} />
        </button>

        {/* Volume Controls */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={handleToggleMute}
            className="p-1.5 text-on-surface-variant hover:text-white transition-colors"
            title={volume === 0 ? 'Unmute' : 'Mute'}
            aria-label={volume === 0 ? 'Unmute' : 'Mute'}
          >
            {volume === 0 ? <VolumeX size={18} /> : volume < 0.5 ? <Volume1 size={18} /> : <Volume2 size={18} />}
          </button>

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            aria-label="Volume"
            className="w-24 cursor-pointer"
          />
        </div>

        <button
          onClick={() => setIsNowPlayingOpen(true)}
          className="p-2 rounded text-on-surface-variant hover:text-white transition-colors hidden sm:block"
          title="Full screen"
          aria-label="Full screen player"
        >
          <Maximize2 size={16} />
        </button>
      </div>
    </footer>
  );
};
