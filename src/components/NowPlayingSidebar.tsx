import React, { useState, useEffect } from 'react';
import { 
  X, 
  Heart, 
  Share2, 
  MoreHorizontal, 
  Users, 
  Sparkles, 
  Play, 
  ExternalLink,
  Plus,
  FolderPlus
} from 'lucide-react';
import { Track, Artist } from '../types';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { DatabaseService } from '../services/firebase';
import { CoverArt } from './CoverArt';

interface NowPlayingSidebarProps {
  onClose: () => void;
  onSelectArtist: (artistId: string) => void;
  onOpenAddToPlaylist?: (track: Track) => void;
}

export const NowPlayingSidebar: React.FC<NowPlayingSidebarProps> = ({
  onClose,
  onSelectArtist,
  onOpenAddToPlaylist
}) => {
  const { currentTrack, queue, isPlaying, playTrack, logInteraction } = useAudio();
  const { currentUser, toggleLikeTrack } = useAuth();

  const [artist, setArtist] = useState<Artist | null>(null);
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [copiedShare, setCopiedShare] = useState<boolean>(false);

  useEffect(() => {
    if (!currentTrack) return;
    DatabaseService.getArtistById(currentTrack.artistId || currentTrack.artist).then(a => {
      setArtist(a);
    });
  }, [currentTrack]);

  if (!currentTrack) return null;

  const isLiked = Boolean(currentUser?.likedTrackIds?.includes(currentTrack.id));
  const currentIndex = queue.findIndex(t => t.id === currentTrack.id);
  const nextTrack = currentIndex >= 0 && currentIndex < queue.length - 1 ? queue[currentIndex + 1] : null;

  const handleShare = () => {
    logInteraction('share', currentTrack.id);
    navigator.clipboard?.writeText(window.location.href);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  return (
    <aside className="w-84 app-panel bg-surface-container-lowest flex flex-col h-full select-none flex-shrink-0 overflow-y-auto">
      {/* Top Header */}
      <div className="px-4 py-3 flex items-center justify-between sticky top-0 bg-surface-container-lowest z-10">
        <h3 className="text-base font-bold text-white truncate max-w-[220px]">
          {currentTrack.album || currentTrack.title}
        </h3>

        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-white transition-colors"
          title="Close panel"
          aria-label="Close now playing panel"
        >
          <X size={18} />
        </button>
      </div>

      <div className="p-4 space-y-5">
        {/* Large Album Artwork */}
        <div className="relative aspect-square w-full rounded-lg overflow-hidden shadow-card group">
          <CoverArt
            src={currentTrack.coverUrl}
            title={currentTrack.title}
            artist={currentTrack.artist}
            id={currentTrack.id}
            loading="eager"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Track Title & Artist */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold text-white tracking-tight truncate hover:underline cursor-pointer">
              {currentTrack.title}
            </h2>
            <button
              type="button"
              onClick={() => {
                if (currentTrack.artistId) {
                  onSelectArtist(currentTrack.artistId);
                }
              }}
              className="block max-w-full text-sm text-on-surface-variant hover:text-white hover:underline transition-colors truncate mt-1 text-left"
            >
              {currentTrack.artist}
            </button>
          </div>

          <div className="flex items-center gap-1">
            {onOpenAddToPlaylist && (
              <button
                onClick={() => onOpenAddToPlaylist(currentTrack)}
                className="p-2 rounded-full text-on-surface-variant hover:text-white transition-colors"
                title="Add to playlist"
                aria-label="Add to playlist"
              >
                <FolderPlus size={18} />
              </button>
            )}

            <button
              onClick={() => {
                toggleLikeTrack(currentTrack.id);
                logInteraction(isLiked ? 'unlike' : 'like', currentTrack.id);
              }}
              className={`p-2 rounded-full transition-colors ${
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

        {/* About the Artist Card */}
        {artist && (
          <div className="relative rounded-lg overflow-hidden bg-surface-container group">
            <div className="relative h-44 overflow-hidden">
              <CoverArt
                src={artist.bannerUrl || artist.avatarUrl}
                title={artist.name}
                id={artist.id}
                className="w-full h-full object-cover filter brightness-75 group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container/40 to-transparent" />
              <span className="absolute top-3 left-3 text-base font-bold text-white">
                About the artist
              </span>
            </div>

            <div className="p-4 -mt-6 relative z-10 space-y-3">
              <div>
                <h4 
                  onClick={() => onSelectArtist(artist.id)}
                  className="text-base font-bold text-white hover:underline cursor-pointer tracking-tight"
                >
                  {artist.name}
                </h4>
                <p className="text-sm text-on-surface-variant flex items-center gap-1.5 mt-1">
                  <Users size={14} />
                  <span>{artist.monthlyListeners.toLocaleString()} monthly listeners</span>
                </p>
              </div>

              <p className="text-sm text-on-surface-variant line-clamp-2 leading-relaxed">
                {artist.bio}
              </p>

              <div className="pt-1 flex items-center justify-between">
                <button
                  onClick={() => setIsFollowing(!isFollowing)}
                  className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-all ${
                    isFollowing
                      ? 'border-white/30 text-white hover:border-white'
                      : 'bg-white text-black border-white hover:scale-105'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>

                <button
                  onClick={() => onSelectArtist(artist.id)}
                  className="text-sm font-bold text-on-surface-variant hover:text-white hover:underline flex items-center gap-1"
                >
                  <span>View Discography</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Next in Queue Card */}
        {nextTrack && (
          <div className="p-4 rounded-lg bg-surface-container space-y-3">
            <div className="flex items-center justify-between text-base font-bold text-white">
              <span>Next in queue</span>
            </div>

            <button
              type="button"
              onClick={() => playTrack(nextTrack, queue)}
              className="w-full flex items-center justify-between gap-3 group text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <CoverArt
                  src={nextTrack.coverUrl}
                  title={nextTrack.title}
                  artist={nextTrack.artist}
                  id={nextTrack.id}
                  className="w-10 h-10 rounded object-cover flex-shrink-0"
                />
                <div className="min-w-0">
                  <h5 className="text-sm font-bold text-white truncate">{nextTrack.title}</h5>
                  <p className="text-2xs text-on-surface-variant truncate">{nextTrack.artist}</p>
                </div>
              </div>

              <div className="w-8 h-8 rounded-full bg-white/10 group-hover:bg-primary group-hover:text-on-primary flex items-center justify-center text-white transition-colors flex-shrink-0">
                <Play size={14} fill="currentColor" className="ml-0.5" />
              </div>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
