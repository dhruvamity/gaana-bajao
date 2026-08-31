import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Heart, 
  Share2, 
  TrendingUp, 
  Sparkles, 
  Disc, 
  Users, 
  ChevronLeft,
  Clock,
  Activity
} from 'lucide-react';
import { Artist, Track } from '../types';
import { DatabaseService, onTracksChanged } from '../services/firebase';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { FolderPlus } from 'lucide-react';
import { CoverArt } from './CoverArt';
import { getCoverTint } from '../utils/coverArt';

interface ArtistViewProps {
  artistId: string;
  onBack: () => void;
  onOpenAddToPlaylist?: (track: Track) => void;
}

export const ArtistView: React.FC<ArtistViewProps> = ({ 
  artistId, 
  onBack,
  onOpenAddToPlaylist
}) => {
  const { playTrack, playOrToggle, currentTrack, isPlaying, logInteraction } = useAudio();
  const { currentUser, toggleLikeTrack } = useAuth();

  const [artist, setArtist] = useState<Artist | null>(null);
  const [artistTracks, setArtistTracks] = useState<Track[]>([]);
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [copiedShare, setCopiedShare] = useState<boolean>(false);

  useEffect(() => {
    const loadArtistData = async () => {
      const target = await DatabaseService.getArtistById(artistId);
      const tracks = await DatabaseService.getTracks();
      const filtered = tracks.filter(t => 
        (target && t.artistId === target.id) || 
        t.artist.toLowerCase() === (target?.name || artistId).toLowerCase() ||
        t.artistId === artistId
      );

      if (target) {
        setArtist(target);
      } else if (filtered.length > 0) {
        // Dynamic fallback artist profile from track
        const first = filtered[0];
        setArtist({
          id: artistId,
          name: first.artist,
          bio: `${first.artist} on Gaana-Bajao library.`,
          avatarUrl: first.coverUrl,
          bannerUrl: first.coverUrl,
          monthlyListeners: filtered.length * 450,
          genres: Array.from(new Set(filtered.map(f => f.genre))),
          topTrackIds: filtered.map(f => f.id),
          albumIds: [],
          velocity: 'Trending'
        });
      }
      setArtistTracks(filtered);
    };

    loadArtistData();
    const unsubscribe = onTracksChanged(() => {
      loadArtistData();
    });
    return () => unsubscribe();
  }, [artistId]);

  if (!artist) return null;

  const handleFollow = () => {
    setIsFollowing(!isFollowing);
    logInteraction('like', artistTracks[0]?.id);
  };

  const handleShare = () => {
    logInteraction('share', artistTracks[0]?.id);
    navigator.clipboard?.writeText(window.location.href);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const heroTint = getCoverTint({ title: artist.name, id: artist.id });

  return (
    <div className="relative -mt-header pb-8">
      {/* Hero banner, running up behind the sticky top bar. Back navigation
          lives in that bar now, so the page does not carry its own. */}
      <section
        className="relative overflow-hidden h-[22rem] sm:h-96 flex flex-col justify-end p-6 pt-header sm:p-10 sm:pt-header"
        style={{ background: `linear-gradient(180deg, ${heroTint} 0%, #121212 100%)` }}
      >
        <CoverArt
          src={artist.bannerUrl}
          title={artist.name}
          id={artist.id}
          loading="eager"
          className="absolute inset-0 w-full h-full object-cover filter brightness-50"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-transparent to-transparent" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 text-primary border border-white/10 text-xs font-bold uppercase tracking-wider">
              <TrendingUp size={13} />
              {artist.velocity}
            </div>
            <h1 className="font-extrabold text-white tracking-display [font-size:clamp(2rem,5.5vw,6rem)] [line-height:1.05]">
              {artist.name}
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant flex items-center gap-2">
              <Users size={14} />
              <span>{artist.monthlyListeners.toLocaleString()} monthly listeners</span>
              <span>•</span>
              <span className="text-primary font-medium">{artist.genres.join(', ')}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => artistTracks.length > 0 && playTrack(artistTracks[0], artistTracks)}
              className="px-6 py-3 rounded-lg bg-primary hover:bg-primary-fixed text-on-primary font-bold text-sm flex items-center gap-2 shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              <Play size={18} fill="currentColor" />
              <span>Play All</span>
            </button>

            <button
              onClick={handleFollow}
              className={`px-5 py-3 rounded-lg text-sm font-semibold bg-white/10 hover:bg-white/20 border transition-all ${
                isFollowing ? 'bg-primary/20 text-primary border-white/20' : 'text-white border-white/10 hover:border-white/30'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>

            <button
              onClick={handleShare}
              className="p-3 rounded-lg bg-white/10 hover:bg-white/20 text-on-surface-variant hover:text-white transition-all relative"
            >
              <Share2 size={18} />
              {copiedShare && (
                <span className="absolute -top-8 right-0 bg-primary text-on-primary px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap shadow-lg">
                  Copied!
                </span>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Popular Tracks Section */}
      <section className="px-6 pt-6 space-y-4">
        <h3 className="text-2xl font-bold text-white tracking-tight">Popular</h3>

        <div className="space-y-2">
          {artistTracks.map((track, idx) => {
            const isTrackActive = currentTrack?.id === track.id;
            const isLiked = Boolean(currentUser?.likedTrackIds?.includes(track.id));

            return (
              <div
                key={track.id}
                className={`group p-3 sm:px-4 sm:py-3 rounded-lg bg-surface-container border transition-all flex items-center justify-between gap-4 hover:border-primary/30 hover:bg-white/5 ${
                  isTrackActive ? 'border-primary/50 bg-primary/10' : 'border-white/5'
                }`}
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <span className="text-xs font-bold text-on-surface-variant w-4 text-center">
                    {idx + 1}
                  </span>

                  <div className="relative w-12 h-12 rounded overflow-hidden shadow-md flex-shrink-0">
                    <CoverArt src={track.coverUrl} title={track.title} artist={track.artist} id={track.id} className="w-full h-full object-cover" />
                    <button
                      onClick={() => playOrToggle(track, artistTracks)}
                      className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {isTrackActive && isPlaying ? (
                        <Pause size={16} fill="currentColor" />
                      ) : (
                        <Play size={16} fill="currentColor" className="ml-0.5" />
                      )}
                    </button>
                  </div>

                  <div className="min-w-0">
                    <h4 className={`text-sm font-semibold truncate ${isTrackActive ? 'text-primary' : 'text-white'}`}>
                      {track.title}
                    </h4>
                    <p className="text-xs text-on-surface-variant truncate">{track.album}</p>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-6 text-xs text-on-surface-variant">
                  <span>{track.playCount.toLocaleString()} plays</span>
                  <span className="flex items-center gap-1 text-primary"><Activity size={12} /> {track.acoustics.tempo} BPM</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> {formatDuration(track.duration)}</span>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  {onOpenAddToPlaylist && (
                    <button
                      onClick={() => onOpenAddToPlaylist(track)}
                      className="p-2 rounded-full text-on-surface-variant hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                      title="Add to playlist"
                    >
                      <FolderPlus size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      toggleLikeTrack(track.id);
                      logInteraction(isLiked ? 'unlike' : 'like', track.id);
                    }}
                    className={`p-2 rounded-full transition-all ${
                      isLiked ? 'text-primary' : 'text-on-surface-variant hover:text-white'
                    }`}
                  >
                    <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={() => playOrToggle(track, artistTracks)}
                    className="p-2 rounded bg-white/10 hover:bg-white/20 text-primary hover:bg-primary/20 transition-all"
                  >
                    {isTrackActive && isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* About & Genres Section */}
      <section className="px-6 pt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 p-6 rounded-lg bg-surface-container space-y-3">
          <h3 className="text-xl font-bold text-white">About the Artist</h3>
          <p className="text-sm text-on-surface-variant leading-relaxed">{artist.bio}</p>
        </div>

        <div className="p-6 rounded-lg bg-surface-container space-y-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            <span>Genres & Style</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {artist.genres.map(genre => (
              <span key={genre} className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full text-xs font-semibold text-white">
                {genre}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
