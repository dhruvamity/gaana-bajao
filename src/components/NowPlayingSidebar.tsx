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
    <aside className="w-72 sm:w-84 bg-surface-container-lowest/90 backdrop-blur-2xl border-l border-white/5 flex flex-col h-full select-none transition-all flex-shrink-0 overflow-y-auto pb-28 scrollbar-thin scrollbar-thumb-white/10">
      {/* Top Header */}
      <div className="p-4 flex items-center justify-between border-b border-white/5 sticky top-0 bg-surface-container-lowest/95 backdrop-blur-md z-10">
        <h3 className="text-sm font-bold text-white truncate max-w-[190px]">
          {currentTrack.album || currentTrack.title}
        </h3>

        <div className="flex items-center gap-1">
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-on-surface-variant hover:text-white transition-all"
            title="Close panel"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Large Album Artwork */}
        <div className="relative aspect-square w-full rounded-2xl overflow-hidden shadow-2xl group ring-1 ring-white/10">
          <img
            src={currentTrack.coverUrl}
            alt={currentTrack.title}
            className={`w-full h-full object-cover transition-transform duration-700 ${isPlaying ? 'scale-102' : 'scale-100'}`}
          />
        </div>

        {/* Track Title & Artist */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold text-white tracking-tight truncate hover:underline cursor-pointer">
              {currentTrack.title}
            </h2>
            <p
              onClick={() => {
                if (currentTrack.artistId) {
                  onSelectArtist(currentTrack.artistId);
                }
              }}
              className="text-xs font-semibold text-on-surface-variant hover:text-white cursor-pointer transition-colors truncate mt-0.5"
            >
              {currentTrack.artist}
            </p>
          </div>

          <div className="flex items-center gap-1">
            {onOpenAddToPlaylist && (
              <button
                onClick={() => onOpenAddToPlaylist(currentTrack)}
                className="p-2 rounded-full text-on-surface-variant hover:text-white transition-all"
                title="Add to playlist"
              >
                <FolderPlus size={18} />
              </button>
            )}

            <button
              onClick={() => {
                toggleLikeTrack(currentTrack.id);
                logInteraction(isLiked ? 'unlike' : 'like', currentTrack.id);
              }}
              className={`p-2 rounded-full transition-all ${
                isLiked ? 'text-primary' : 'text-on-surface-variant hover:text-white'
              }`}
              title={isLiked ? 'Unlike' : 'Like'}
            >
              <Heart size={18} fill={isLiked ? '#7dd3fc' : 'none'} />
            </button>
          </div>
        </div>

        {/* About the Artist Card */}
        {artist && (
          <div className="relative rounded-2xl overflow-hidden bg-surface-container/60 border border-white/10 group hover:border-primary/30 transition-all">
            <div className="relative h-44 overflow-hidden">
              <img
                src={artist.bannerUrl || artist.avatarUrl}
                alt={artist.name}
                className="w-full h-full object-cover filter brightness-75 group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container/40 to-transparent" />
              <span className="absolute top-3 left-3 text-xs font-bold text-white uppercase tracking-wider">
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
                <p className="text-xs text-on-surface-variant flex items-center gap-1.5 mt-0.5">
                  <Users size={12} />
                  <span>{artist.monthlyListeners.toLocaleString()} monthly listeners</span>
                </p>
              </div>

              <p className="text-xs text-on-surface-variant line-clamp-3 leading-relaxed">
                {artist.bio}
              </p>

              <div className="pt-1 flex items-center justify-between">
                <button
                  onClick={() => setIsFollowing(!isFollowing)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    isFollowing
                      ? 'border-white/30 text-white hover:border-white'
                      : 'bg-white text-black border-white hover:scale-105'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>

                <button
                  onClick={() => onSelectArtist(artist.id)}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  <span>View Discography</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Next in Queue Card */}
        {nextTrack && (
          <div className="p-3.5 rounded-2xl bg-surface-container/60 border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              <span>Next in Queue</span>
            </div>

            <div 
              onClick={() => playTrack(nextTrack, queue)}
              className="flex items-center justify-between gap-3 group cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={nextTrack.coverUrl}
                  alt={nextTrack.title}
                  className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                />
                <div className="min-w-0">
                  <h5 className="text-xs font-bold text-white group-hover:text-primary transition-colors truncate">
                    {nextTrack.title}
                  </h5>
                  <p className="text-[11px] text-on-surface-variant truncate">{nextTrack.artist}</p>
                </div>
              </div>

              <div className="w-8 h-8 rounded-full bg-white/10 group-hover:bg-primary group-hover:text-on-primary flex items-center justify-center text-white transition-all flex-shrink-0">
                <Play size={14} fill="currentColor" className="ml-0.5" />
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
