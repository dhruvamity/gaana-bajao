import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Sparkles, 
  Play, 
  Pause, 
  Heart, 
  SlidersHorizontal, 
  Music, 
  Zap, 
  Flame, 
  Moon, 
  Clock,
  Activity,
  Radio,
  FolderPlus
} from 'lucide-react';
import { Track } from '../types';
import { DatabaseService } from '../services/firebase';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { CoverArt } from './CoverArt';
import { SectionHeader } from './SectionHeader';

interface SearchExploreViewProps {
  /** Query shared with the navbar search box. */
  query: string;
  onQueryChange: (query: string) => void;
  onSelectArtist?: (artistId: string) => void;
  onOpenAddToPlaylist?: (track: Track) => void;
}

const GRADIENT_PALETTES = [
  'from-blue-600/40 to-cyan-500/40',
  'from-pink-600/40 to-purple-600/40',
  'from-amber-600/40 to-orange-500/40',
  'from-emerald-600/40 to-teal-500/40',
  'from-rose-600/40 to-red-500/40',
  'from-violet-600/40 to-indigo-500/40',
  'from-fuchsia-600/40 to-pink-500/40',
  'from-sky-600/40 to-blue-500/40'
];

function getGenreGradient(genre: string): string {
  let hash = 0;
  for (let i = 0; i < genre.length; i++) {
    hash = genre.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GRADIENT_PALETTES.length;
  return GRADIENT_PALETTES[index];
}

export const SearchExploreView: React.FC<SearchExploreViewProps> = ({
  query,
  onQueryChange,
  onSelectArtist,
  onOpenAddToPlaylist
}) => {
  const { playTrack, playOrToggle, currentTrack, isPlaying, logInteraction } = useAudio();
  const { currentUser, toggleLikeTrack } = useAuth();

  const searchQuery = query;
  const [catalog, setCatalog] = useState<Track[]>([]);
  const [filteredTracks, setFilteredTracks] = useState<Track[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [minEnergy, setMinEnergy] = useState<number>(0);
  const [isFiltersOpen, setIsFiltersOpen] = useState<boolean>(false);
  const [isAiProcessing, setIsAiProcessing] = useState<boolean>(false);

  // Derive genres dynamically from catalog
  const availableGenres = useMemo(() => {
    const genresSet = new Set<string>();
    catalog.forEach(t => {
      if (t.genre) genresSet.add(t.genre);
    });
    return Array.from(genresSet);
  }, [catalog]);

  // Derive smart prompts dynamically from actual catalog
  const suggestedPrompts = useMemo(() => {
    if (catalog.length === 0) {
      return ['Electronic beats', 'Focus vibes', 'Chill ambiance', 'High energy'];
    }
    const prompts: string[] = [];
    const genres = Array.from(new Set(catalog.map(t => t.genre).filter(Boolean)));
    genres.slice(0, 3).forEach(g => {
      prompts.push(`Best of ${g}`);
    });

    const tags = Array.from(new Set(catalog.flatMap(t => t.tags || []).filter(Boolean)));
    tags.slice(0, 2).forEach(tag => {
      prompts.push(`${tag} music`);
    });

    return prompts.slice(0, 4);
  }, [catalog]);

  useEffect(() => {
    DatabaseService.getTracks().then(tracks => {
      setCatalog(tracks);
      setFilteredTracks(tracks);
    });
  }, []);

  useEffect(() => {
    let results = catalog;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(t => 
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q) ||
        t.genre.toLowerCase().includes(q) ||
        (t.tags && t.tags.some(tag => tag.toLowerCase().includes(q)))
      );
    }

    if (selectedGenre) {
      results = results.filter(t => t.genre.toLowerCase() === selectedGenre.toLowerCase());
    }

    if (minEnergy > 0) {
      results = results.filter(t => (t.acoustics?.energy || 0.5) >= minEnergy);
    }

    setFilteredTracks(results);
  }, [searchQuery, selectedGenre, minEnergy, catalog]);

  const handlePromptClick = (promptText: string) => {
    onQueryChange(promptText);
    setIsAiProcessing(true);
    setTimeout(() => {
      setIsAiProcessing(false);
    }, 300);
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-10 pb-32 px-6 lg:px-8 pt-4">
      <div className="space-y-4">
        {/* No search field here: the top bar carries it on this view, as in the
            comp, and both are bound to the same query state. */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-on-surface-variant flex items-center gap-2">
            {isAiProcessing && <Sparkles size={15} className="text-primary animate-spin" />}
            {searchQuery
              ? `Results for “${searchQuery}”`
              : 'Browse the catalog, or search from the bar above.'}
          </span>

          <button
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            aria-pressed={isFiltersOpen}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${
              isFiltersOpen
                ? 'bg-white text-black'
                : 'bg-surface-container-high text-white hover:bg-surface-container-highest'
            }`}
            title="Audio filters"
          >
            <SlidersHorizontal size={15} />
            <span>Filters</span>
          </button>
        </div>

        {/* Dynamic Suggested Prompts */}
        {suggestedPrompts.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-on-surface-variant flex items-center gap-1 mr-1">
              <Sparkles size={13} className="text-primary" /> Suggestions:
            </span>
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handlePromptClick(prompt)}
                className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 border border-white/10 text-xs text-on-surface-variant hover:text-white hover:border-white/20 transition-all"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Advanced Acoustic Filters Tray */}
        {isFiltersOpen && (
          <div className="p-4 rounded-lg bg-surface-container space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between text-xs font-bold text-white">
              <span className="flex items-center gap-1.5"><Activity size={14} className="text-primary" /> Minimum Acoustic Energy</span>
              <span>{Math.round(minEnergy * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={minEnergy}
              onChange={(e) => setMinEnergy(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
            {minEnergy > 0 && (
              <button
                onClick={() => setMinEnergy(0)}
                className="text-[11px] text-primary hover:underline font-bold"
              >
                Reset Energy Filter
              </button>
            )}
          </div>
        )}
      </div>

      {/* Dynamic Browse by Genre Tiles */}
      {availableGenres.length > 0 && (
        <section>
          <SectionHeader title="Browse all" />
          <div className="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(160px,1fr))]">
            {availableGenres.map((genre) => {
              const isSelected = selectedGenre?.toLowerCase() === genre.toLowerCase();
              const gradient = getGenreGradient(genre);
              const count = catalog.filter(
                t => t.genre?.toLowerCase() === genre.toLowerCase()
              ).length;

              return (
                <button
                  key={genre}
                  onClick={() => setSelectedGenre(isSelected ? null : genre)}
                  aria-pressed={isSelected}
                  className={`relative aspect-[16/13] rounded-lg overflow-hidden p-4 text-left bg-gradient-to-br ${gradient} transition-transform hover:scale-[1.02] ${
                    isSelected ? 'ring-2 ring-white' : ''
                  }`}
                >
                  <span className="block text-xl font-extrabold text-white tracking-title leading-tight line-clamp-3">
                    {genre}
                  </span>
                  <span className="absolute bottom-3 left-4 text-2xs font-bold uppercase tracking-label text-white/75">
                    {count} {count === 1 ? 'track' : 'tracks'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Search Results List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-white tracking-display">
            {searchQuery || selectedGenre ? 'Results' : 'All tracks'}
          </h2>
          <span className="text-xs text-on-surface-variant font-medium">
            {filteredTracks.length} {filteredTracks.length === 1 ? 'track' : 'tracks'}
          </span>
        </div>

        {filteredTracks.length === 0 ? (
          <div className="p-12 text-center rounded-lg bg-surface-container space-y-2">
            <Music size={32} className="mx-auto text-on-surface-variant opacity-40" />
            <p className="text-sm font-semibold text-white">No matching tracks found</p>
            <p className="text-xs text-on-surface-variant">Try searching for a different song, artist, or genre.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTracks.map((track, idx) => {
              const isTrackActive = currentTrack?.id === track.id;
              const isLiked = currentUser?.likedTrackIds?.includes(track.id);

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
                        onClick={() => playOrToggle(track, filteredTracks)}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
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
                      <p 
                        onClick={() => track.artistId && onSelectArtist && onSelectArtist(track.artistId)}
                        className="text-xs text-on-surface-variant hover:text-white cursor-pointer transition-colors truncate"
                      >
                        {track.artist} • {track.album}
                      </p>
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-4 text-xs text-on-surface-variant">
                    <span className="bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-full text-[11px] text-white/80">{track.genre}</span>
                    <span className="flex items-center gap-1 text-primary"><Activity size={12} /> {track.acoustics?.tempo || 120} BPM</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> {formatDuration(track.duration)}</span>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {onOpenAddToPlaylist && (
                      <button
                        onClick={() => onOpenAddToPlaylist(track)}
                        className="p-2 rounded-full text-on-surface-variant hover:text-white opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
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
                      className={`p-2 rounded-full transition-all cursor-pointer ${
                        isLiked ? 'text-primary' : 'text-on-surface-variant hover:text-white'
                      }`}
                    >
                      <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={() => playOrToggle(track, filteredTracks)}
                      className="p-2 rounded bg-white/10 hover:bg-white/20 text-primary hover:bg-primary/20 transition-all cursor-pointer"
                    >
                      {isTrackActive && isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
