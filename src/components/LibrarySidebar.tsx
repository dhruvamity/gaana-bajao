import React, { useState, useEffect } from 'react';
import { 
  Library, 
  Plus, 
  Search, 
  Heart, 
  Music, 
  Users, 
  Pin, 
  ArrowUpDown,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X
} from 'lucide-react';
import { Playlist, Artist, Track } from '../types';
import { DatabaseService } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useAudio } from '../context/AudioContext';
import { CoverArt } from './CoverArt';

interface LibrarySidebarProps {
  currentView: string;
  selectedPlaylistId?: string;
  selectedArtistId?: string;
  onSelectPlaylist: (playlist: Playlist) => void;
  onSelectArtist: (artistId: string) => void;
  onSelectLikedSongs: () => void;
  onOpenCreatePlaylist: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const LibrarySidebar: React.FC<LibrarySidebarProps> = ({
  currentView,
  selectedPlaylistId,
  selectedArtistId,
  onSelectPlaylist,
  onSelectArtist,
  onSelectLikedSongs,
  onOpenCreatePlaylist,
  isCollapsed,
  onToggleCollapse
}) => {
  const { currentUser } = useAuth();
  const { playTrack } = useAudio();

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'playlists' | 'artists'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const loadLibrary = async () => {
      const [pls, arts] = await Promise.all([
        DatabaseService.getPlaylists(),
        DatabaseService.getArtists()
      ]);
      setPlaylists(pls);
      setArtists(arts);
    };

    loadLibrary();
  }, [currentView]);

  const filteredPlaylists = playlists.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.ownerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredArtists = artists.filter(a => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isCollapsed) {
    return (
      <aside className="w-18 app-panel bg-surface-container-lowest flex flex-col items-center py-4 gap-4 select-none h-full">
        <button
          onClick={onToggleCollapse}
          className="p-3 rounded text-on-surface-variant hover:text-white transition-colors"
          title="Expand Your Library"
          aria-label="Expand your library"
        >
          <Library size={24} />
        </button>

        <button
          onClick={onOpenCreatePlaylist}
          className="p-3 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-white transition-colors"
          title="Create Playlist"
          aria-label="Create playlist"
        >
          <Plus size={20} />
        </button>

        <div className="w-8 h-px bg-white/10 my-1" />

        {/* Liked songs mini icon */}
        <button
          onClick={onSelectLikedSongs}
          className="w-12 h-12 rounded bg-gradient-to-br from-[#450af5] to-[#8e8ee5] flex items-center justify-center hover:scale-105 transition-transform"
          title="Liked Songs"
          aria-label="Liked Songs"
        >
          <Heart size={18} fill="currentColor" className="text-white" />
        </button>

        {/* Playlists mini covers */}
        <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-280px)] pr-0.5 scrollbar-none">
          {playlists.slice(0, 8).map(pl => (
            <button
              key={pl.id}
              onClick={() => onSelectPlaylist(pl)}
              className="w-12 h-12 rounded overflow-hidden hover:scale-105 transition-transform block group"
              title={pl.title}
            >
              <CoverArt src={pl.coverUrl} title={pl.title} artist={pl.ownerName} id={pl.id} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-72 sm:w-80 app-panel bg-surface-container-lowest flex flex-col h-full select-none flex-shrink-0">
      {/* Sidebar Header */}
      <div className="p-4 pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={onToggleCollapse}
            className="flex items-center gap-3 text-on-surface-variant hover:text-white font-bold text-base tracking-tight transition-colors group"
            aria-label="Collapse your library"
          >
            <Library size={24} className="text-on-surface-variant group-hover:text-white transition-colors" />
            <span>Your Library</span>
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={onOpenCreatePlaylist}
              className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-white transition-colors"
              title="Create playlist or folder"
              aria-label="Create playlist"
            >
              <Plus size={18} />
            </button>
            <button
              onClick={onToggleCollapse}
              className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-white transition-colors"
              title="Collapse library"
              aria-label="Collapse library"
            >
              <ChevronLeft size={18} />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveFilter(activeFilter === 'playlists' ? 'all' : 'playlists')}
            aria-pressed={activeFilter === 'playlists'}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
              activeFilter === 'playlists'
                ? 'bg-white text-black font-medium'
                : 'bg-surface-container-high text-white hover:bg-surface-container-highest'
            }`}
          >
            Playlists
          </button>
          <button
            onClick={() => setActiveFilter(activeFilter === 'artists' ? 'all' : 'artists')}
            aria-pressed={activeFilter === 'artists'}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
              activeFilter === 'artists'
                ? 'bg-white text-black font-medium'
                : 'bg-surface-container-high text-white hover:bg-surface-container-highest'
            }`}
          >
            Artists
          </button>
        </div>

        {/* Search & Sort Row */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center">
            {isSearchOpen ? (
              <div className="relative flex items-center">
                <Search size={14} className="absolute left-2.5 text-on-surface-variant" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search in Your Library"
                  aria-label="Search in your library"
                  className="w-44 pl-8 pr-6 py-1.5 rounded bg-surface-container-high text-white text-sm placeholder-on-surface-variant focus:outline-none"
                />
                <button 
                  onClick={() => {
                    setIsSearchOpen(false);
                    setSearchQuery('');
                  }}
                  className="absolute right-1.5 text-on-surface-variant hover:text-white"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsSearchOpen(true)}
                className="p-1.5 rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-white transition-colors"
                title="Search in Your Library"
                aria-label="Search in your library"
              >
                <Search size={16} />
              </button>
            )}
          </div>

          <button
            type="button"
            className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-white transition-colors"
            title="Sort order"
          >
            <span>Recents</span>
            <ArrowUpDown size={16} />
          </button>
        </div>
      </div>

      {/* Scrollable Library Content List */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 space-y-0.5 pb-4">
        {/* 1. Liked Songs Pinned Row */}
        {activeFilter !== 'artists' && (!searchQuery || 'liked songs'.includes(searchQuery.toLowerCase())) && (
          <button
            type="button"
            onClick={onSelectLikedSongs}
            className={`w-full text-left p-2 rounded flex items-center gap-3 transition-colors ${
              currentView === 'liked' ? 'bg-white/10' : 'hover:bg-white/10'
            }`}
          >
            <div className="w-12 h-12 rounded bg-gradient-to-br from-[#450af5] to-[#8e8ee5] flex items-center justify-center flex-shrink-0">
              <Heart size={20} fill="currentColor" className="text-white" />
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="text-base text-white truncate">Liked Songs</h4>
              <p className="text-sm text-on-surface-variant flex items-center gap-1.5 truncate">
                <Pin size={12} className="text-primary fill-primary flex-shrink-0" />
                <span>Playlist &bull; {currentUser?.likedTrackIds?.length || 0} songs</span>
              </p>
            </div>
          </button>
        )}

        {/* 2. Playlists List */}
        {activeFilter !== 'artists' && filteredPlaylists.map((pl) => {
          const isSelected = currentView === 'playlist' && selectedPlaylistId === pl.id;

          return (
            <button
              type="button"
              key={pl.id}
              onClick={() => onSelectPlaylist(pl)}
              aria-current={isSelected ? 'page' : undefined}
              className={`w-full text-left p-2 rounded flex items-center gap-3 transition-colors ${
                isSelected ? 'bg-white/10' : 'hover:bg-white/10'
              }`}
            >
              <CoverArt
                src={pl.coverUrl}
                title={pl.title}
                artist={pl.ownerName}
                id={pl.id}
                className="w-12 h-12 rounded object-cover flex-shrink-0"
              />

              <div className="min-w-0 flex-1">
                <h4 className={`text-base truncate ${isSelected ? 'text-primary' : 'text-white'}`}>
                  {pl.title}
                </h4>
                <p className="text-sm text-on-surface-variant truncate">
                  Playlist &bull; {pl.ownerName}
                </p>
              </div>
            </button>
          );
        })}

        {/* 3. Artists List */}
        {activeFilter !== 'playlists' && filteredArtists.map((artist) => {
          const isSelected = currentView === 'artist' && selectedArtistId === artist.id;

          return (
            <button
              type="button"
              key={artist.id}
              onClick={() => onSelectArtist(artist.id)}
              aria-current={isSelected ? 'page' : undefined}
              className={`w-full text-left p-2 rounded flex items-center gap-3 transition-colors ${
                isSelected ? 'bg-white/10' : 'hover:bg-white/10'
              }`}
            >
              <CoverArt
                src={artist.avatarUrl}
                title={artist.name}
                id={artist.id}
                className="w-12 h-12 rounded-full object-cover flex-shrink-0"
              />

              <div className="min-w-0 flex-1">
                <h4 className={`text-base truncate ${isSelected ? 'text-primary' : 'text-white'}`}>
                  {artist.name}
                </h4>
                <p className="text-sm text-on-surface-variant truncate">Artist</p>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
};
