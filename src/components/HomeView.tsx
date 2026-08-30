import React, { useState, useEffect, useMemo } from 'react';
import { Play, Heart, FolderPlus, UploadCloud } from 'lucide-react';
import { Track, Playlist, Artist, Shelf, TelemetryEvent } from '../types';
import { DatabaseService } from '../services/firebase';
import { RecommendationEngine } from '../services/recommendationEngine';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { CoverArt } from './CoverArt';
import { MediaCard } from './MediaCard';
import { SectionHeader } from './SectionHeader';

interface HomeViewProps {
  onSelectArtist: (artistId: string) => void;
  onSelectPlaylist: (playlist: Playlist) => void;
  onOpenAddToPlaylist?: (track: Track) => void;
  onSelectLikedSongs?: () => void;
  onOpenUpload?: () => void;
  onSeeAllPlaylists?: () => void;
}

/** The comp's home hero is a saturated indigo fading into the column. */
const HOME_HERO = '#3333a3';

/** A card row: fluid, but sized around the comp's 224px tile and 31px gutter.
 *  The floor drops on small screens so a phone gets two columns rather than one
 *  card stretched across the whole width. */
const CARD_GRID =
  'grid gap-4 sm:gap-[31px] [grid-template-columns:repeat(auto-fill,minmax(136px,1fr))] ' +
  'sm:[grid-template-columns:repeat(auto-fill,minmax(168px,1fr))]';

export const HomeView: React.FC<HomeViewProps> = ({
  onSelectArtist,
  onSelectPlaylist,
  onOpenAddToPlaylist,
  onSelectLikedSongs,
  onOpenUpload,
  onSeeAllPlaylists
}) => {
  const { currentTrack, isPlaying, playTrack, togglePlay, logInteraction } = useAudio();
  const { currentUser, timeOfDay, activityContext, deviceType, toggleLikeTrack } = useAuth();

  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  useEffect(() => {
    const loadData = async () => {
      const [allTracks, allPlaylists, allArtists, allEvents] = await Promise.all([
        DatabaseService.getTracks(),
        DatabaseService.getPlaylists(),
        DatabaseService.getArtists(),
        DatabaseService.getTelemetryEvents()
      ]);
      setTracks(allTracks);
      setPlaylists(allPlaylists);
      setArtists(allArtists);
      setEvents(allEvents);
    };

    loadData();
  }, []);

  const getGreeting = () => {
    switch (timeOfDay) {
      case 'morning': return 'Good morning';
      case 'afternoon': return 'Good afternoon';
      case 'evening': return 'Good evening';
      case 'night': return 'Late night vibes';
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

  /* The comp opens with a two-column grid of wide shortcut tiles under the
     greeting: the fastest way back into what you already listen to. */
  const shortcuts = useMemo(() => {
    const cards: Array<{
      id: string;
      title: string;
      coverUrl: string;
      isLikedCard?: boolean;
      playlist?: Playlist;
    }> = [];

    if (currentUser?.likedTrackIds && currentUser.likedTrackIds.length > 0) {
      cards.push({ id: 'quick_liked', title: 'Liked Songs', coverUrl: '', isLikedCard: true });
    }

    playlists.slice(0, 5).forEach(pl => {
      cards.push({ id: pl.id, title: pl.title, coverUrl: pl.coverUrl || '', playlist: pl });
    });

    return cards.slice(0, 6);
  }, [currentUser?.likedTrackIds, playlists]);

  /* The recommendation engine drives the top of the page.
     `generateHomeShelves` was fully implemented but had never been called from
     anywhere in the app, so every interaction the player recorded fed a model
     whose output nothing displayed. Empty shelves are dropped: the orchestrator
     always emits its contextual and discovery shelves even with no catalog. */
  const shelves = useMemo<Shelf[]>(() => {
    if (!currentUser || tracks.length === 0) return [];
    try {
      return RecommendationEngine.generateHomeShelves(tracks, currentUser, events, {
        timeOfDay,
        activity: activityContext,
        deviceType
      }).filter(shelf => shelf.tracks.length > 0);
    } catch (err) {
      // A ranking failure must not take the home page down with it.
      console.warn('Shelf generation failed', err);
      return [];
    }
  }, [tracks, events, currentUser, timeOfDay, activityContext, deviceType]);

  const filteredTracks = useMemo(() => {
    if (activeCategory === 'all') return tracks;
    const cat = activeCategory.toLowerCase();
    return tracks.filter(t =>
      t.genre?.toLowerCase() === cat ||
      (t.tags && t.tags.some(tag => tag.toLowerCase() === cat))
    );
  }, [tracks, activeCategory]);

  const playPlaylist = (pl: Playlist) => {
    const plTracks = tracks.filter(t => pl.trackIds.includes(t.id));
    if (plTracks.length > 0) playTrack(plTracks[0], plTracks);
  };

  const playLiked = () => {
    const likedIds = currentUser?.likedTrackIds || [];
    const likedTracks = tracks.filter(t => likedIds.includes(t.id));
    if (likedTracks.length > 0) playTrack(likedTracks[0], likedTracks);
  };

  return (
    /* Pulled up under the sticky top bar so the hero wash runs behind it, then
       padded back down so content still starts below the bar. */
    <div className="relative -mt-header pt-header">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[420px] hero-wash pointer-events-none"
        style={{ ['--hero' as string]: HOME_HERO }}
      />

      <div className="relative px-4 sm:px-6 lg:px-8 pb-12">
        {/* Genre filter pills, derived from what is actually in the catalog. */}
        {dynamicCategories.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pt-2 pb-6">
            {dynamicCategories.map(cat => {
              const isSelected = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  aria-pressed={isSelected}
                  className={`px-4 py-1.5 rounded-full text-sm capitalize whitespace-nowrap transition-colors ${
                    isSelected
                      ? 'bg-white text-black font-bold'
                      : 'bg-black/40 hover:bg-black/60 text-white'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}

        <h1 className="text-[clamp(2rem,3.2vw,2.5rem)] font-extrabold text-white tracking-display mb-7">
          {getGreeting()}{currentUser ? `, ${currentUser.name}` : ''}
        </h1>

        {/* Shortcut grid. Figma: 479x82 tiles at white/10 and 6px radius, with
            the artwork filling the tile's full height on the leading edge. */}
        {shortcuts.length > 0 && (
          <div className="grid gap-x-6 gap-y-3 grid-cols-1 xl:grid-cols-2 mb-12">
            {shortcuts.map(card => (
              <div key={card.id} className="group relative surface-tile h-tile flex items-center overflow-hidden">
                {card.isLikedCard ? (
                  <div className="w-tile h-tile bg-gradient-to-br from-[#450af5] to-[#8e8ee5] flex items-center justify-center flex-shrink-0">
                    <Heart size={28} fill="currentColor" className="text-white" />
                  </div>
                ) : (
                  <CoverArt
                    src={card.coverUrl}
                    title={card.title}
                    id={card.id}
                    className="w-tile h-tile object-cover flex-shrink-0"
                  />
                )}

                <span className="flex-1 px-5 text-xl font-bold text-white truncate">
                  {card.title}
                </span>

                <button
                  type="button"
                  onClick={() => (card.playlist ? playPlaylist(card.playlist) : playLiked())}
                  className="tile-fab relative z-20 mr-5 w-12 h-12 flex-shrink-0 rounded-full bg-primary hover:bg-primary-fixed text-on-primary flex items-center justify-center shadow-play hover:scale-105 transition-transform"
                  aria-label={`Play ${card.title}`}
                >
                  <Play size={20} fill="currentColor" className="ml-0.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (card.isLikedCard && onSelectLikedSongs) onSelectLikedSongs();
                    else if (card.playlist) onSelectPlaylist(card.playlist);
                  }}
                  className="absolute inset-0 z-10"
                  aria-label={`Open ${card.title}`}
                />
              </div>
            ))}
          </div>
        )}

        {/* Engine-generated shelves. Each card's subtitle carries the reason
            the engine picked it, so the ranking is legible rather than opaque. */}
        {shelves.map(shelf => (
          <section key={shelf.id} className="mb-12">
            <SectionHeader title={shelf.title} meta={shelf.badge || shelf.subtitle} />
            <div className={CARD_GRID}>
              {shelf.tracks.map(track => {
                const isTrackPlaying = currentTrack?.id === track.id && isPlaying;
                return (
                  <MediaCard
                    key={`${shelf.id}-${track.id}`}
                    id={track.id}
                    title={track.title}
                    artist={track.artist}
                    coverUrl={track.coverUrl}
                    subtitle={track.recommendationReason || track.artist}
                    isPlaying={isTrackPlaying}
                    isCurrent={currentTrack?.id === track.id}
                    onOpen={() => {
                      if (currentTrack?.id === track.id) togglePlay();
                      else playTrack(track, shelf.tracks);
                    }}
                    onPlay={() => {
                      if (currentTrack?.id === track.id) togglePlay();
                      else playTrack(track, shelf.tracks);
                    }}
                  />
                );
              })}
            </div>
          </section>
        ))}

        {playlists.length > 0 && (
          <section className="mb-12">
            <SectionHeader title="Your playlists" onSeeAll={onSeeAllPlaylists} />
            <div className={CARD_GRID}>
              {playlists.map(pl => (
                <MediaCard
                  key={pl.id}
                  id={pl.id}
                  title={pl.title}
                  artist={pl.ownerName}
                  coverUrl={pl.coverUrl}
                  subtitle={`${pl.trackIds.length} ${pl.trackIds.length === 1 ? 'track' : 'tracks'} · ${pl.ownerName}`}
                  onOpen={() => onSelectPlaylist(pl)}
                  onPlay={() => playPlaylist(pl)}
                />
              ))}
            </div>
          </section>
        )}

        {filteredTracks.length > 0 ? (
          <section className="mb-12">
            <SectionHeader
              title={activeCategory === 'all' ? 'Your tracks' : activeCategory}
              meta={`${filteredTracks.length} ${filteredTracks.length === 1 ? 'track' : 'tracks'}`}
            />
            <div className={CARD_GRID}>
              {filteredTracks.map(track => {
                const isTrackPlaying = currentTrack?.id === track.id && isPlaying;
                const isLiked = Boolean(currentUser?.likedTrackIds?.includes(track.id));

                return (
                  <MediaCard
                    key={track.id}
                    id={track.id}
                    title={track.title}
                    artist={track.artist}
                    coverUrl={track.coverUrl}
                    subtitle={track.artist}
                    isPlaying={isTrackPlaying}
                    isCurrent={currentTrack?.id === track.id}
                    onOpen={() => {
                      if (track.artistId) onSelectArtist(track.artistId);
                      else if (currentTrack?.id === track.id) togglePlay();
                      else playTrack(track, filteredTracks);
                    }}
                    onPlay={() => {
                      if (currentTrack?.id === track.id) togglePlay();
                      else playTrack(track, filteredTracks);
                    }}
                    footer={
                      <div className="flex items-center justify-between text-2xs text-on-surface-variant">
                        <span className="truncate max-w-[100px]">{track.genre || 'Music'}</span>
                        <div className="flex items-center gap-1">
                          {onOpenAddToPlaylist && (
                            <button
                              onClick={() => onOpenAddToPlaylist(track)}
                              className="p-1 hover:text-white transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                              title="Add to playlist"
                              aria-label={`Add ${track.title} to a playlist`}
                            >
                              <FolderPlus size={15} />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              toggleLikeTrack(track.id);
                              logInteraction(isLiked ? 'unlike' : 'like', track.id);
                            }}
                            className={`p-1 transition-colors ${isLiked ? 'text-primary' : 'hover:text-white'}`}
                            title={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
                            aria-label={isLiked ? `Unlike ${track.title}` : `Like ${track.title}`}
                            aria-pressed={isLiked}
                          >
                            <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
                          </button>
                        </div>
                      </div>
                    }
                  />
                );
              })}
            </div>
          </section>
        ) : (
          <div className="p-12 text-center rounded-lg bg-surface-container space-y-5 max-w-lg mx-auto my-8">
            <div className="w-18 h-18 mx-auto rounded-full bg-surface-container-high text-primary flex items-center justify-center">
              <UploadCloud size={36} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-2xl font-bold text-white">
                {activeCategory === 'all' ? 'Your library is empty' : `Nothing tagged “${activeCategory}”`}
              </h3>
              <p className="text-sm text-on-surface-variant max-w-sm mx-auto leading-relaxed">
                Upload your audio files (.mp3, .wav, .flac). They appear here with their
                embedded artwork, tags and acoustic analysis.
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

        {artists.length > 0 && (
          <section>
            <SectionHeader
              title="Artists"
              meta={`${artists.length} ${artists.length === 1 ? 'artist' : 'artists'}`}
            />
            <div className={CARD_GRID}>
              {artists.map(artist => (
                <MediaCard
                  key={artist.id}
                  id={artist.id}
                  title={artist.name}
                  coverUrl={artist.avatarUrl}
                  subtitle="Artist"
                  shape="circle"
                  onOpen={() => onSelectArtist(artist.id)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
