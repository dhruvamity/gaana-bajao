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
      <aside className="w-18 bg-surface-container-lowest/80 backdrop-blur-xl border-r border-white/5 flex flex-col items-center py-4 gap-4 select-none h-full transition-all">
        <button
          onClick={onToggleCollapse}
          className="p-3 rounded-2xl text-on-surface-variant hover:text-white hover:bg-white/5 transition-all"
          title="Expand Your Library"
        >
          <Library size={22} />
        </button>

        <button
          onClick={onOpenCreatePlaylist}
          className="p-3 rounded-2xl bg-white/5 hover:bg-primary/20 text-primary transition-all"
          title="Create Playlist"
        >
          <Plus size={20} />
        </button>

        <div className="w-8 h-px bg-white/10 my-1" />

        {/* Liked songs mini icon */}
        <button
          onClick={onSelectLikedSongs}
          className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-500 flex items-center justify-center shadow-md hover:scale-105 transition-transform"
          title="Liked Songs"
        >
          <Heart size={18} fill="#ffffff" className="text-white" />
        </button>

        {/* Playlists mini covers */}
        <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-280px)] pr-0.5 scrollbar-none">
          {playlists.slice(0, 8).map(pl => (
            <button
              key={pl.id}
              onClick={() => onSelectPlaylist(pl)}
              className="w-11 h-11 rounded-xl overflow-hidden shadow-sm hover:ring-2 ring-primary/50 transition-all block group"
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
    <aside className="w-72 sm:w-80 bg-surface-container-lowest/90 backdrop-blur-2xl border-r border-white/5 flex flex-col h-full select-none transition-all flex-shrink-0">
      {/* Sidebar Header */}
      <div className="p-4 pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={onToggleCollapse}
            className="flex items-center gap-2.5 text-on-surface-variant hover:text-white font-bold text-sm tracking-tight transition-colors group"
          >
            <Library size={20} className="text-on-surface-variant group-hover:text-white transition-colors" />
            <span>Your Library</span>
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={onOpenCreatePlaylist}
              className="p-2 rounded-full hover:bg-white/10 text-on-surface-variant hover:text-white transition-all"
              title="Create playlist or folder"
            >
              <Plus size={18} />
            </button>
            <button
              onClick={onToggleCollapse}
              className="p-2 rounded-full hover:bg-white/10 text-on-surface-variant hover:text-white transition-all"
              title="Collapse library"
            >
              <ChevronLeft size={18} />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveFilter(activeFilter === 'playlists' ? 'all' : 'playlists')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              activeFilter === 'playlists'
                ? 'bg-white text-black font-bold'
                : 'bg-white/5 text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            Playlists
          </button>
          <button
            onClick={() => setActiveFilter(activeFilter === 'artists' ? 'all' : 'artists')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              activeFilter === 'artists'
                ? 'bg-white text-black font-bold'
                : 'bg-white/5 text-white/80 hover:bg-white/10 hover:text-white'
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
                  className="w-44 pl-8 pr-6 py-1 rounded-lg bg-white/10 text-white text-xs placeholder-on-surface-variant focus:outline-none focus:ring-1 ring-primary"
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
                className="p-1.5 rounded-full hover:bg-white/10 text-on-surface-variant hover:text-white transition-all"
                title="Search in Your Library"
              >
                <Search size={16} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 text-xs text-on-surface-variant hover:text-white cursor-pointer transition-colors font-medium">
            <span>Recents</span>
            <ArrowUpDown size={13} />
          </div>
        </div>
      </div>

      {/* Scrollable Library Content List */}
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-24 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
        {/* 1. Liked Songs Pinned Row */}
        {activeFilter !== 'artists' && (!searchQuery || 'liked songs'.includes(searchQuery.toLowerCase())) && (
          <div
            onClick={onSelectLikedSongs}
            className={`group p-2 rounded-xl flex items-center gap-3 cursor-pointer transition-all ${
              currentView === 'liked'
                ? 'bg-white/10 text-white'
                : 'hover:bg-white/5 text-on-surface-variant hover:text-white'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-102 transition-transform">
              <Heart size={20} fill="#ffffff" className="text-white" />
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-white truncate group-hover:text-primary transition-colors">
                Liked Songs
              </h4>
              <p className="text-xs text-on-surface-variant flex items-center gap-1.5 truncate mt-0.5">
                <Pin size={11} className="text-primary fill-primary flex-shrink-0" />
                <span>Playlist • {currentUser?.likedTrackIds?.length || 0} songs</span>
              </p>
            </div>
          </div>
        )}

        {/* 2. Playlists List */}
        {activeFilter !== 'artists' && filteredPlaylists.map((pl) => {
          const isSelected = currentView === 'playlist' && selectedPlaylistId === pl.id;

          return (
            <div
              key={pl.id}
              onClick={() => onSelectPlaylist(pl)}
              className={`group p-2 rounded-xl flex items-center gap-3 cursor-pointer transition-all ${
                isSelected
                  ? 'bg-white/10 text-white font-semibold'
                  : 'hover:bg-white/5 text-on-surface-variant hover:text-white'
              }`}
            >
              <CoverArt
                src={pl.coverUrl}
                title={pl.title}
                artist={pl.ownerName}
                id={pl.id}
                className="w-12 h-12 rounded-xl object-cover flex-shrink-0 group-hover:scale-102 transition-transform shadow-sm"
              />

              <div className="min-w-0 flex-1">
                <h4 className={`text-sm truncate transition-colors ${isSelected ? 'text-primary font-bold' : 'text-white font-medium group-hover:text-primary'}`}>
                  {pl.title}
                </h4>
                <p className="text-xs text-on-surface-variant truncate mt-0.5">
                  Playlist • {pl.ownerName}
                </p>
              </div>
            </div>
          );
        })}

        {/* 3. Artists List */}
        {activeFilter !== 'playlists' && filteredArtists.map((artist) => {
          const isSelected = currentView === 'artist' && selectedArtistId === artist.id;

          return (
            <div
              key={artist.id}
              onClick={() => onSelectArtist(artist.id)}
              className={`group p-2 rounded-xl flex items-center gap-3 cursor-pointer transition-all ${
                isSelected
                  ? 'bg-white/10 text-white font-semibold'
                  : 'hover:bg-white/5 text-on-surface-variant hover:text-white'
              }`}
            >
              <CoverArt
                src={artist.avatarUrl}
                title={artist.name}
                id={artist.id}
                className="w-12 h-12 rounded-full object-cover flex-shrink-0 group-hover:scale-102 transition-transform shadow-sm"
              />

              <div className="min-w-0 flex-1">
                <h4 className={`text-sm truncate transition-colors ${isSelected ? 'text-primary font-bold' : 'text-white font-medium group-hover:text-primary'}`}>
                  {artist.name}
                </h4>
                <p className="text-xs text-on-surface-variant truncate mt-0.5">
                  Artist
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
