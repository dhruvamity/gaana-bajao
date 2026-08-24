import React, { useState, useEffect, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  Heart, 
  Sparkles, 
  TrendingUp, 
  Activity, 
  Clock, 
  Flame, 
  Compass, 
  Layers,
  ChevronRight,
  FolderPlus,
  UploadCloud,
  Music,
  User,
  ListMusic
} from 'lucide-react';
import { Track, Playlist, Artist } from '../types';
import { DatabaseService } from '../services/firebase';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';

interface HomeViewProps {
  onSelectArtist: (artistId: string) => void;
  onSelectPlaylist: (playlist: Playlist) => void;
  onOpenAddToPlaylist?: (track: Track) => void;
  onSelectLikedSongs?: () => void;
  onOpenUpload?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onSelectArtist,
  onSelectPlaylist,
  onOpenAddToPlaylist,
  onSelectLikedSongs,
  onOpenUpload
}) => {
  const { currentTrack, isPlaying, playTrack, togglePlay, logInteraction } = useAudio();
  const { currentUser, timeOfDay, toggleLikeTrack } = useAuth();

  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  useEffect(() => {
    const loadData = async () => {
      const [allTracks, allPlaylists, allArtists] = await Promise.all([
        DatabaseService.getTracks(),
        DatabaseService.getPlaylists(),
        DatabaseService.getArtists()
      ]);
      setTracks(allTracks);
      setPlaylists(allPlaylists);
      setArtists(allArtists);
    };

    loadData();
  }, []);

  const getGreeting = () => {
    switch (timeOfDay) {
      case 'morning': return 'Good morning';
      case 'afternoon': return 'Good afternoon';
      case 'evening': return 'Good evening';
      case 'night': return 'Late Night Vibes';
    }
  };

  // Dynamically derive categories from uploaded tracks
  const dynamicCategories = useMemo(() => {
    const categoriesSet = new Set<string>();
    tracks.forEach(t => {
      if (t.genre) categoriesSet.add(t.genre);
      if (t.tags && Array.isArray(t.tags)) {
        t.tags.forEach(tag => {
          if (tag.trim()) categoriesSet.add(tag.trim());
        });
      }
    });
    return ['all', ...Array.from(categoriesSet).slice(0, 8)];
  }, [tracks]);

  // Top quick cards for Liked Songs & User-Created Playlists
  const quickCards = useMemo(() => {
    const cards: Array<{
      id: string;
      title: string;
      coverUrl: string;
      isLikedCard?: boolean;
      playlist?: Playlist;
    }> = [];

    if (currentUser?.likedTrackIds && currentUser.likedTrackIds.length > 0) {
      cards.push({
        id: 'quick_liked',
        title: 'Liked Songs',
        coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300&auto=format&fit=crop&q=80',
        isLikedCard: true
      });
    }

    playlists.slice(0, 7).forEach(pl => {
      cards.push({
        id: pl.id,
        title: pl.title,
        coverUrl: pl.coverUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=80',
        playlist: pl
      });
    });

    return cards;
  }, [currentUser?.likedTrackIds, playlists]);

  // Filter tracks by selected genre/tag
  const filteredTracks = useMemo(() => {
    if (activeCategory === 'all') return tracks;
    const cat = activeCategory.toLowerCase();
    return tracks.filter(t => 
      t.genre?.toLowerCase() === cat ||
      (t.tags && t.tags.some(tag => tag.toLowerCase() === cat))
    );
  }, [tracks, activeCategory]);

  return (
    <div className="space-y-8 pb-32 max-w-7xl mx-auto px-4 sm:px-8 pt-6">
      
      {/* 1. Category Chips Bar (Dynamically derived from actual uploaded music) */}
      {dynamicCategories.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none sticky top-16 z-20 py-2 bg-background/80 backdrop-blur-md -mx-4 px-4 sm:-mx-8 sm:px-8">
          {dynamicCategories.map(cat => {
            const isSelected = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white text-black shadow-md scale-105'
                    : 'bg-surface-container hover:bg-white/15 text-white'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* Greeting Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {getGreeting()}{currentUser ? `, ${currentUser.name}` : ''}
          </h1>
          <p className="text-xs text-on-surface-variant font-medium mt-0.5">
            Cloud streaming catalog & high-fidelity playback
          </p>
        </div>

        {onOpenUpload && (
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-bold transition-all hover:scale-105 cursor-pointer shadow-lg shadow-primary/10"
          >
            <UploadCloud size={16} />
            <span>Upload Music</span>
          </button>
        )}
      </div>

      {/* 2. Quick Access Cards (Liked Songs & Created Playlists) */}
      {quickCards.length > 0 && (
        <section className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {quickCards.map((card) => {
              const isLiked = card.isLikedCard;
              const playlist = card.playlist;

              return (
                <div
                  key={card.id}
                  onClick={() => {
                    if (isLiked && onSelectLikedSongs) {
                      onSelectLikedSongs();
                    } else if (playlist) {
                      onSelectPlaylist(playlist);
                    }
                  }}
                  className="group relative flex items-center bg-surface-container hover:bg-surface-container-high rounded-lg overflow-hidden cursor-pointer transition-all shadow-sm hover:shadow-md"
                >
                  {isLiked ? (
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-pink-500 flex items-center justify-center flex-shrink-0">
                      <Heart size={24} fill="#ffffff" className="text-white" />
                    </div>
                  ) : (
                    <img
                      src={card.coverUrl}
                      alt={card.title}
                      className="w-16 h-16 object-cover flex-shrink-0"
                    />
                  )}

                  <div className="flex-1 px-3.5 py-2 min-w-0 pr-12">
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:underline">
                      {card.title}
                    </h4>
                  </div>

                  {/* Hover Play Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (playlist) {
                        const plTracks = tracks.filter(t => playlist.trackIds.includes(t.id));
                        if (plTracks.length > 0) playTrack(plTracks[0], plTracks);
                      } else if (tracks.length > 0) {
                        playTrack(tracks[0], tracks);
                      }
                    }}
                    className="absolute right-3 w-10 h-10 rounded-full bg-primary hover:bg-primary-fixed text-on-primary flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all hover:scale-105"
                    title="Play"
                  >
                    <Play size={18} fill="currentColor" className="ml-0.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. User-Created Playlists Section */}
      {playlists.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Collection
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Your Playlists
              </h2>
            </div>
            <span className="text-xs text-on-surface-variant font-medium">
              {playlists.length} {playlists.length === 1 ? 'playlist' : 'playlists'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {playlists.map((pl) => (
              <div
                key={pl.id}
                onClick={() => onSelectPlaylist(pl)}
                className="group p-3.5 rounded-2xl bg-surface-container hover:bg-surface-container-high transition-all cursor-pointer space-y-3 relative hover:scale-102"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden shadow-md">
                  <img
                    src={pl.coverUrl}
                    alt={pl.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />

                  {/* Play Button Overlay */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const plTracks = tracks.filter(t => pl.trackIds.includes(t.id));
                      if (plTracks.length > 0) playTrack(plTracks[0], plTracks);
                    }}
                    className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all hover:scale-105"
                    title="Play Playlist"
                  >
                    <Play size={18} fill="currentColor" className="ml-0.5" />
                  </button>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white truncate group-hover:text-primary transition-colors">
                    {pl.title}
                  </h4>
                  <p className="text-xs text-on-surface-variant truncate mt-0.5">
                    {pl.trackIds.length} {pl.trackIds.length === 1 ? 'track' : 'tracks'} • By {pl.ownerName}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. Uploaded Tracks & Releases */}
      {filteredTracks.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Music Catalog
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {activeCategory === 'all' ? 'Uploaded Tracks' : `Tracks in ${activeCategory}`}
              </h2>
            </div>
            <span className="text-xs text-on-surface-variant font-medium">
              {filteredTracks.length} {filteredTracks.length === 1 ? 'track' : 'tracks'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredTracks.map((track) => {
              const isTrackPlaying = currentTrack?.id === track.id && isPlaying;
              const isLiked = Boolean(currentUser?.likedTrackIds?.includes(track.id));

              return (
                <div
                  key={track.id}
                  onClick={() => playTrack(track, filteredTracks)}
                  className="group p-3.5 rounded-2xl bg-surface-container hover:bg-surface-container-high transition-all cursor-pointer space-y-3 relative hover:scale-102"
                >
                  <div className="relative aspect-square rounded-xl overflow-hidden shadow-md">
                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />

                    {/* Floating Play Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (currentTrack?.id === track.id) {
                          togglePlay();
                        } else {
                          playTrack(track, filteredTracks);
                        }
                      }}
                      className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all hover:scale-105"
                      title={isTrackPlaying ? 'Pause' : 'Play'}
                    >
                      {isTrackPlaying ? (
                        <Pause size={18} fill="currentColor" />
                      ) : (
                        <Play size={18} fill="currentColor" className="ml-0.5" />
                      )}
                    </button>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-white truncate group-hover:text-primary transition-colors">
                      {track.title}
                    </h4>
                    <p 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (track.artistId) onSelectArtist(track.artistId);
                      }}
                      className="text-xs text-on-surface-variant hover:text-white hover:underline cursor-pointer transition-colors truncate mt-0.5"
                    >
                      {track.artist}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px] text-on-surface-variant">
                    <span className="text-primary font-medium truncate max-w-[90px]">{track.genre || 'Music'}</span>
                    <div className="flex items-center gap-1">
                      {onOpenAddToPlaylist && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenAddToPlaylist(track);
                          }}
                          className="p-1 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                          title="Add to playlist"
                        >
                          <FolderPlus size={14} />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLikeTrack(track.id);
                          logInteraction(isLiked ? 'unlike' : 'like', track.id);
                        }}
                        className={`p-1 transition-colors ${
                          isLiked ? 'text-primary' : 'hover:text-white'
                        }`}
                      >
                        <Heart size={14} fill={isLiked ? '#7dd3fc' : 'none'} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        /* Empty Catalog Hero CTA */
        <div className="p-12 text-center rounded-3xl bg-surface-container/60 border border-white/10 space-y-5 max-w-lg mx-auto my-8">
          <div className="w-18 h-18 mx-auto rounded-3xl bg-gradient-to-tr from-primary/30 to-primary-container/20 text-primary flex items-center justify-center shadow-xl shadow-primary/10">
            <UploadCloud size={36} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-xl font-black text-white">Your Cloud Music Library is Empty</h3>
            <p className="text-xs text-on-surface-variant max-w-sm mx-auto leading-relaxed">
              Upload your audio files (.mp3, .wav, .flac) to Cloudinary. They will automatically appear in your catalog with acoustic analysis, lyrics, and custom playlists!
            </p>
          </div>
          {onOpenUpload && (
            <button
              onClick={onOpenUpload}
              className="px-6 py-3.5 rounded-2xl bg-white hover:bg-white/90 text-black font-extrabold text-xs inline-flex items-center gap-2 shadow-xl hover:scale-105 transition-all cursor-pointer"
            >
              <UploadCloud size={16} />
              <span>Upload Songs to Cloudinary</span>
            </button>
          )}
        </div>
      )}

      {/* 5. Artists Section (Derived only when tracks exist) */}
      {artists.length > 0 && (
        <section className="space-y-4 pt-4 border-t border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Artists
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Artists in Your Catalog
              </h2>
            </div>
            <span className="text-xs text-on-surface-variant font-medium">
              {artists.length} {artists.length === 1 ? 'artist' : 'artists'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {artists.map((artist) => (
              <div
                key={artist.id}
                onClick={() => onSelectArtist(artist.id)}
                className="group p-3.5 rounded-2xl bg-surface-container hover:bg-surface-container-high transition-all cursor-pointer space-y-3 text-center hover:scale-102"
              >
                <div className="relative aspect-square rounded-full overflow-hidden shadow-md mx-auto max-w-[140px]">
                  <img
                    src={artist.avatarUrl}
                    alt={artist.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white truncate group-hover:text-primary transition-colors">
                    {artist.name}
                  </h4>
                  <p className="text-xs text-on-surface-variant truncate mt-0.5">
                    Artist • {artist.genres.slice(0, 2).join(', ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
