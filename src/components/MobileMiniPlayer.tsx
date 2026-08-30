import React from 'react';
import { Play, Pause, Heart } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { CoverArt } from './CoverArt';
import { getCoverTint } from '../utils/coverArt';

/**
 * The docked player from the mobile comp.
 *
 * Figma: a 410x59 card inset 6px from each edge, tinted from the artwork, with
 * 37px art, the track title, the connected device underneath, a play control,
 * and the progress rail along the card's bottom edge.
 *
 * The desktop player bar is a different object entirely — 112px with full
 * transport and volume — so this is a separate component rather than a pile of
 * responsive overrides on that one.
 */
export const MobileMiniPlayer: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    progress,
    duration,
    togglePlay,
    setIsNowPlayingOpen,
    logInteraction
  } = useAudio();

  const { currentUser, toggleLikeTrack } = useAuth();

  if (!currentTrack) return null;

  const isLiked = Boolean(currentUser?.likedTrackIds?.includes(currentTrack.id));
  const percent = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;

  // The comp tints the card from the album art; this is the same seed the
  // generated covers use, so a track's card and its artwork agree.
  const tint = getCoverTint(
    { title: currentTrack.title, artist: currentTrack.artist, id: currentTrack.id },
    { lightness: 22 }
  );

  return (
    <div className="md:hidden flex-shrink-0 px-1.5 pb-1.5">
      <div
        className="relative h-dock rounded-md overflow-hidden flex items-center gap-3 pl-2.5 pr-3"
        style={{ backgroundColor: tint }}
      >
        <CoverArt
          src={currentTrack.coverUrl}
          title={currentTrack.title}
          artist={currentTrack.artist}
          id={currentTrack.id}
          loading="eager"
          className="w-[37px] h-[37px] rounded-sm object-cover flex-shrink-0"
        />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">{currentTrack.title}</p>
          {/* The comp shows the connected Bluetooth device here. This app has
              a Connect feature, but the audio context does not expose which
              device is active, so the line carries the artist instead of a
              made-up device name. */}
          <p className="text-2xs text-white/70 truncate">{currentTrack.artist}</p>
        </div>

        <button
          type="button"
          onClick={() => {
            toggleLikeTrack(currentTrack.id);
            logInteraction(isLiked ? 'unlike' : 'like', currentTrack.id);
          }}
          className={`p-1 flex-shrink-0 relative z-10 ${isLiked ? 'text-primary' : 'text-white/80'}`}
          aria-label={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
          aria-pressed={isLiked}
        >
          <Heart size={19} fill={isLiked ? 'currentColor' : 'none'} />
        </button>

        <button
          type="button"
          onClick={togglePlay}
          className="p-1 flex-shrink-0 text-white relative z-10"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause size={24} fill="currentColor" />
          ) : (
            <Play size={24} fill="currentColor" />
          )}
        </button>

        {/* Progress runs along the card's bottom edge, as in the comp. */}
        <div className="absolute bottom-0 inset-x-4 h-1 rounded-full bg-white/30">
          <div className="h-full rounded-full bg-white" style={{ width: `${percent}%` }} />
        </div>

        {/* Tapping the card opens the full-screen player. Kept behind the
            controls so their own taps are not swallowed. */}
        <button
          type="button"
          onClick={() => setIsNowPlayingOpen(true)}
          className="absolute inset-0"
          aria-label={`Open player for ${currentTrack.title}`}
        />
      </div>
    </div>
  );
};
