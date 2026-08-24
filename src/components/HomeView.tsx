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
import { CoverArt } from './CoverArt';

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
        coverUrl: '',
        isLikedCard: true
      });
    }

    playlists.slice(0, 7).forEach(pl => {
      cards.push({
        id: pl.id,
        title: pl.title,
        coverUrl: pl.coverUrl || '',
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
    <div className="space-y-6 pb-8 px-4 sm:px-6 pt-4">
      
      {/* 1. Category Chips Bar (Dynamically derived from actual uploaded music) */}
      {dynamicCategories.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none sticky top-0 z-20 py-3 bg-surface-container-lowest -mx-4 px-4 sm:-mx-6 sm:px-6">
          {dynamicCategories.map(cat => {
            const isSelected = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                aria-pressed={isSelected}
                className={`px-3 py-1.5 rounded-full text-sm capitalize whitespace-nowrap transition-colors ${
                  isSelected
                    ? 'bg-white text-black font-medium'
                    : 'bg-surface-container-high hover:bg-surface-container-highest text-white'
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
          <h1 className="text-3xl sm:text-[2rem] font-bold text-white tracking-tight">
            {getGreeting()}{currentUser ? `, ${currentUser.name}` : ''}
          </h1>
        </div>

        {onOpenUpload && (
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black hover:scale-105 text-sm font-bold transition-transform"
          >
            <UploadCloud size={16} />
            <span>Upload Music</span>
          </button>
        )}
      </div>

      {/* 2. Quick Access Cards (Liked Songs & Created Playlists) */}
      {quickCards.length > 0 && (
        <section className="space-y-3">
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
            {quickCards.map((card) => {
              const isLiked = card.isLikedCard;
              const playlist = card.playlist;

              return (
                <button
                  type="button"
                  key={card.id}
                  onClick={() => {
                    if (isLiked && onSelectLikedSongs) {
                      onSelectLikedSongs();
                    } else if (playlist) {
                      onSelectPlaylist(playlist);
                    }
                  }}
                  className="group relative flex items-center text-left bg-white/10 hover:bg-white/20 rounded overflow-hidden transition-colors"
                >
                  {isLiked ? (
                    <div className="w-16 h-16 bg-gradient-to-br from-[#450af5] to-[#8e8ee5] flex items-center justify-center flex-shrink-0">
                      <Heart size={24} fill="currentColor" className="text-white" />
                    </div>
                  ) : (
                    <CoverArt
                      src={card.coverUrl}
                      title={card.title}
                      id={card.id}
                      className="w-16 h-16 object-cover flex-shrink-0"
                    />
                  )}

                  <div className="flex-1 px-4 py-2 min-w-0 pr-12">
                    <h4 className="text-sm sm:text-base font-bold text-white truncate">
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
                    className="absolute right-4 w-12 h-12 rounded-full bg-primary hover:bg-primary-fixed hover:scale-105 text-on-primary flex items-center justify-center shadow-play opacity-0 group-hover:opacity-100 transition-all"
                    title="Play"
                    aria-label={`Play ${card.title}`}
                  >
                    <Play size={20} fill="currentColor" className="ml-0.5" />
                  </button>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. User-Created Playlists Section */}
      {playlists.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-bold text-white tracking-tight hover:underline cursor-default">
              Your Playlists
            </h2>
            <span className="text-sm font-bold text-on-surface-variant hover:text-white hover:underline cursor-pointer">
              Show all
            </span>
          </div>

          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(160px,1fr))]">
            {playlists.map((pl) => (
              <button
                type="button"
                key={pl.id}
                onClick={() => onSelectPlaylist(pl)}
                className="group p-3 rounded-lg text-left surface-card relative"
              >
                <div className="relative aspect-square rounded overflow-hidden shadow-card mb-3">
                  <CoverArt
                    src={pl.coverUrl}
                    title={pl.title}
                    artist={pl.ownerName}
                    id={pl.id}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />

                  {/* Play Button Overlay */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const plTracks = tracks.filter(t => pl.trackIds.includes(t.id));
                      if (plTracks.length > 0) playTrack(plTracks[0], plTracks);
                    }}
                    className="absolute bottom-2 right-2 w-12 h-12 rounded-full bg-primary hover:bg-primary-fixed text-on-primary flex items-center justify-center shadow-play opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all hover:scale-105"
                    title="Play Playlist"
                    aria-label={`Play ${pl.title}`}
                  >
                    <Play size={20} fill="currentColor" className="ml-0.5" />
                  </button>
                </div>

                <div>
                  <h4 className="text-base font-bold text-white truncate">{pl.title}</h4>
                  <p className="text-sm text-on-surface-variant truncate mt-1 line-clamp-2">
                    {pl.trackIds.length} {pl.trackIds.length === 1 ? 'track' : 'tracks'} &bull; {pl.ownerName}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 4. Uploaded Tracks & Releases */}
      {filteredTracks.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {activeCategory === 'all' ? 'Your tracks' : activeCategory}
            </h2>
            <span className="text-sm font-bold text-on-surface-variant">
              {filteredTracks.length} {filteredTracks.length === 1 ? 'track' : 'tracks'}
            </span>
          </div>

          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(160px,1fr))]">
            {filteredTracks.map((track) => {
              const isTrackPlaying = currentTrack?.id === track.id && isPlaying;
              const isLiked = Boolean(currentUser?.likedTrackIds?.includes(track.id));

              return (
                <div
                  key={track.id}
                  className="group p-3 rounded-lg surface-card relative"
                >
                  <div className="relative aspect-square rounded overflow-hidden shadow-card mb-3">
                    <CoverArt
                      src={track.coverUrl}
                      title={track.title}
                      artist={track.artist}
                      id={track.id}
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
                      className={`absolute bottom-2 right-2 w-12 h-12 rounded-full bg-primary hover:bg-primary-fixed text-on-primary flex items-center justify-center shadow-play transition-all hover:scale-105 ${
                        isTrackPlaying
                          ? 'opacity-100 translate-y-0'
                          : 'opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0'
                      }`}
                      title={isTrackPlaying ? 'Pause' : 'Play'}
                      aria-label={`${isTrackPlaying ? 'Pause' : 'Play'} ${track.title}`}
                    >
                      {isTrackPlaying ? (
                        <Pause size={20} fill="currentColor" />
                      ) : (
                        <Play size={20} fill="currentColor" className="ml-0.5" />
                      )}
                    </button>
                  </div>

                  <div>
                    <h4 className={`text-base font-bold truncate ${currentTrack?.id === track.id ? 'text-primary' : 'text-white'}`}>
                      {track.title}
                    </h4>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (track.artistId) onSelectArtist(track.artistId);
                      }}
                      className="block max-w-full text-sm text-on-surface-variant hover:text-white hover:underline transition-colors truncate mt-1 text-left"
                    >
                      {track.artist}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-white/5 text-2xs text-on-surface-variant">
                    <span className="truncate max-w-[90px]">{track.genre || 'Music'}</span>
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
                        <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
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
        <div className="p-12 text-center rounded-lg bg-surface-container space-y-5 max-w-lg mx-auto my-8">
          <div className="w-18 h-18 mx-auto rounded-full bg-surface-container-high text-primary flex items-center justify-center">
            <UploadCloud size={36} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-2xl font-bold text-white">Your library is empty</h3>
            <p className="text-sm text-on-surface-variant max-w-sm mx-auto leading-relaxed">
              Upload your audio files (.mp3, .wav, .flac) to Cloudinary. They will automatically appear in your catalog with acoustic analysis, lyrics, and custom playlists!
            </p>
          </div>
          {onOpenUpload && (
            <button
              onClick={onOpenUpload}
              className="px-8 py-3.5 rounded-full bg-white hover:scale-105 text-black font-bold text-sm inline-flex items-center gap-2 transition-transform"
            >
              <UploadCloud size={16} />
              <span>Upload music</span>
            </button>
          )}
        </div>
      )}

      {/* 5. Artists Section (Derived only when tracks exist) */}
      {artists.length > 0 && (
        <section className="space-y-4 pt-4 border-t border-white/5">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-bold text-white tracking-tight">Artists</h2>
            <span className="text-sm font-bold text-on-surface-variant">
              {artists.length} {artists.length === 1 ? 'artist' : 'artists'}
            </span>
          </div>

          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
            {artists.map((artist) => (
              <button
                type="button"
                key={artist.id}
                onClick={() => onSelectArtist(artist.id)}
                className="group p-3 rounded-lg surface-card text-left"
              >
                <div className="relative aspect-square rounded-full overflow-hidden shadow-card mb-3">
                  <CoverArt
                    src={artist.avatarUrl}
                    title={artist.name}
                    id={artist.id}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>

                <div>
                  <h4 className="text-base font-bold text-white truncate">{artist.name}</h4>
                  <p className="text-sm text-on-surface-variant truncate mt-1">Artist</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
