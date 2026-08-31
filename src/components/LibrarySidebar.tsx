import React, { useState, useEffect } from 'react';
import {
  Library,
  Plus,
  Search,
  Heart,
  Home,
  ChevronLeft,
  X,
  MoreVertical,
  Edit3,
  Trash2
} from 'lucide-react';
import { Playlist, Artist, Track } from '../types';
import { DatabaseService, onTracksChanged } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { showToast } from './Toast';
import { CoverArt } from './CoverArt';
import { PlaylistCover } from './PlaylistCover';

interface LibrarySidebarProps {
  currentView: string;
  selectedPlaylistId?: string;
  selectedArtistId?: string;
  onNavigate: (view: string) => void;
  onSelectPlaylist: (playlist: Playlist) => void;
  onSelectArtist: (artistId: string) => void;
  onSelectLikedSongs: () => void;
  onOpenCreatePlaylist: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenEditPlaylist?: (playlist: Playlist) => void;
}

/**
 * The left navigation column.
 *
 * The comp treats this as a flush, square-cornered black column — not a
 * floating panel — carrying three destinations on a 52px pitch, two library
 * actions, a hairline, and then the user's playlists as *plain text*. Artwork
 * appears nowhere in this column.
 */
export const LibrarySidebar: React.FC<LibrarySidebarProps> = ({
  currentView,
  selectedPlaylistId,
  selectedArtistId,
  onNavigate,
  onSelectPlaylist,
  onSelectArtist,
  onSelectLikedSongs,
  onOpenCreatePlaylist,
  isCollapsed,
  onToggleCollapse,
  onOpenEditPlaylist
}) => {
  const { currentUser } = useAuth();

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [activeMenuPlId, setActiveMenuPlId] = useState<string | null>(null);
  /* Only the collapsed rail renders artwork — the expanded column lists
     playlists as plain text — so the catalogue needed to build collage covers
     is fetched only when it can actually be seen. */
  const [tracks, setTracks] = useState<Track[]>([]);
  const [filterQuery, setFilterQuery] = useState('');
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
    const unsubscribe = onTracksChanged(() => {
      loadLibrary();
    });
    return () => unsubscribe();
  }, [currentView]);

  useEffect(() => {
    if (!isCollapsed) return;
    let cancelled = false;
    DatabaseService.getTracks().then(all => {
      if (!cancelled) setTracks(all);
    });
    return () => { cancelled = true; };
  }, [isCollapsed]);

  const q = filterQuery.trim().toLowerCase();
  const filteredPlaylists = q
    ? playlists.filter(p => p.title.toLowerCase().includes(q) || p.ownerName.toLowerCase().includes(q))
    : playlists;
  const filteredArtists = q ? artists.filter(a => a.name.toLowerCase().includes(q)) : artists;

  /* ---------------------------------------------------------------- collapsed */

  if (isCollapsed) {
    return (
      <aside className="w-nav-sm bg-background flex flex-col items-center py-5 gap-5 select-none h-full flex-shrink-0">
        <button
          onClick={onToggleCollapse}
          className="p-2 text-on-surface-variant hover:text-white transition-colors"
          title="Expand your library"
          aria-label="Expand your library"
        >
          <Library size={26} />
        </button>

        <button
          onClick={onOpenCreatePlaylist}
          className="w-10 h-10 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-white transition-colors flex items-center justify-center"
          title="Create playlist"
          aria-label="Create playlist"
        >
          <Plus size={20} />
        </button>

        <button
          onClick={onSelectLikedSongs}
          className="w-11 h-11 rounded bg-gradient-to-br from-[#450af5] to-[#8e8ee5] flex items-center justify-center hover:scale-105 transition-transform"
          title="Liked Songs"
          aria-label="Liked Songs"
        >
          <Heart size={18} fill="currentColor" className="text-white" />
        </button>

        <div className="w-8 h-px bg-white/10" />

        {/* Collapsed is the one place artwork earns its keep: a name would not
            fit, so covers stand in as the only way to tell rows apart. */}
        <div className="flex-1 min-h-0 w-full flex flex-col items-center gap-2 overflow-y-auto scrollbar-none">
          {playlists.map(pl => (
            <button
              key={pl.id}
              onClick={() => onSelectPlaylist(pl)}
              className="w-11 h-11 rounded overflow-hidden hover:scale-105 transition-transform flex-shrink-0"
              title={pl.title}
            >
              <PlaylistCover
                playlist={pl}
                tracks={tracks}
                size={88}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      </aside>
    );
  }

  /* ----------------------------------------------------------------- expanded */

  const navItem = (
    label: string,
    icon: React.ReactNode,
    isActive: boolean,
    onClick: () => void
  ) => (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={`h-13 w-full flex items-center gap-5 text-lg font-bold transition-opacity ${
        isActive ? 'text-white opacity-100' : 'text-white opacity-70 hover:opacity-100'
      }`}
    >
      <span className="w-8 flex items-center justify-center flex-shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );

  return (
    <aside className="w-nav bg-background flex flex-col h-full select-none flex-shrink-0">
      {/* Destinations. Figma places these on a 52px pitch starting 70px down. */}
      <nav className="px-[30px] pt-16 flex flex-col">
        {navItem(
          'Home',
          <Home size={28} fill={currentView === 'home' ? 'currentColor' : 'none'} />,
          currentView === 'home',
          () => onNavigate('home')
        )}
        {navItem(
          'Search',
          <Search size={28} strokeWidth={currentView === 'search' ? 2.75 : 2} />,
          currentView === 'search',
          () => onNavigate('search')
        )}
        {navItem(
          'Your Library',
          <Library size={28} />,
          currentView === 'playlists',
          () => onNavigate('playlists')
        )}
      </nav>

      {/* Library actions, offset below the destinations as in the comp. */}
      <div className="px-[30px] pt-8 flex flex-col">
        <button
          type="button"
          onClick={onOpenCreatePlaylist}
          className="h-13 w-full flex items-center gap-5 text-lg font-bold text-white opacity-70 hover:opacity-100 transition-opacity"
        >
          <span className="w-8 flex items-center justify-center flex-shrink-0">
            <span className="w-6 h-6 rounded-sm bg-on-surface-variant text-black flex items-center justify-center">
              <Plus size={16} strokeWidth={3} />
            </span>
          </span>
          <span>Create Playlist</span>
        </button>

        <button
          type="button"
          onClick={onSelectLikedSongs}
          className="h-13 w-full flex items-center gap-5 text-lg font-bold text-white hover:opacity-100 transition-opacity"
        >
          <span className="w-8 flex items-center justify-center flex-shrink-0">
            <span className="w-6 h-6 rounded-sm bg-gradient-to-br from-[#450af5] to-[#8e8ee5] flex items-center justify-center">
              <Heart size={13} fill="currentColor" className="text-white" />
            </span>
          </span>
          <span>Liked Songs</span>
        </button>
      </div>

      {/* Hairline separating navigation from the library list. */}
      <div className="px-[30px] pt-5">
        <div className="h-px bg-white/15" />
      </div>

      {/* Filter row. Not in the comp, but the list is unbounded in a real
          library and this is the only way to get through a long one. */}
      <div className="px-[30px] pt-3 flex items-center justify-between gap-2 min-h-9">
        {isSearchOpen ? (
          <div className="relative flex items-center w-full">
            <Search size={14} className="absolute left-2.5 text-on-surface-variant" aria-hidden="true" />
            <input
              type="text"
              autoFocus
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter your library"
              aria-label="Filter your library"
              className="w-full pl-8 pr-7 py-1.5 rounded bg-surface-container-high text-white text-sm placeholder-on-surface-variant focus:outline-none"
            />
            <button
              onClick={() => {
                setIsSearchOpen(false);
                setFilterQuery('');
              }}
              className="absolute right-1.5 text-on-surface-variant hover:text-white"
              aria-label="Clear filter"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-1 text-on-surface-variant hover:text-white transition-colors"
              title="Filter your library"
              aria-label="Filter your library"
            >
              <Search size={16} />
            </button>
            <button
              onClick={onToggleCollapse}
              className="p-1 text-on-surface-variant hover:text-white transition-colors"
              title="Collapse library"
              aria-label="Collapse library"
            >
              <ChevronLeft size={18} />
            </button>
          </>
        )}
      </div>

      {/* The library itself: plain 18px text rows, 18px apart, no artwork. */}
      <div className="flex-1 min-h-0 overflow-y-auto px-[30px] py-4 scrollbar-none">
        <ul className="flex flex-col gap-[18px]">
          {filteredPlaylists.map(pl => {
            const isSelected = currentView === 'playlist' && selectedPlaylistId === pl.id;
            const isOwner = pl.ownerId === currentUser?.id;
            const isCollaborator = pl.collaborators?.some(c => c.id === currentUser?.id);
            const canEdit = !pl.isAlgorithmic && (isOwner || isCollaborator);
            const isMenuOpen = activeMenuPlId === pl.id;

            return (
              <li key={pl.id} className="group relative flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelectPlaylist(pl)}
                  aria-current={isSelected ? 'page' : undefined}
                  title={`${pl.title} — playlist by ${pl.ownerName}`}
                  className={`block flex-1 text-left text-lg truncate transition-colors ${
                    isSelected ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-white'
                  }`}
                >
                  {pl.title}
                </button>

                {canEdit && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuPlId(isMenuOpen ? null : pl.id);
                      }}
                      className={`p-1 rounded-md text-on-surface-variant hover:text-white transition-all ${
                        isMenuOpen ? 'opacity-100 text-white bg-white/10' : 'opacity-0 group-hover:opacity-100'
                      }`}
                      title="Playlist options"
                      aria-label="Playlist options"
                    >
                      <MoreVertical size={15} />
                    </button>

                    {isMenuOpen && (
                      <div 
                        className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-surface-container-high border border-white/10 shadow-2xl p-1 z-30 animate-in fade-in zoom-in-95 duration-150"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {onOpenEditPlaylist && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuPlId(null);
                              onOpenEditPlaylist(pl);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white hover:bg-white/10 transition-colors text-left"
                          >
                            <Edit3 size={13} className="text-primary flex-shrink-0" />
                            <span>Edit Details</span>
                          </button>
                        )}

                        {isOwner && (
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              setActiveMenuPlId(null);
                              if (window.confirm(`Are you sure you want to delete "${pl.title}"?`)) {
                                await DatabaseService.deletePlaylist(pl.id);
                                showToast(`Playlist "${pl.title}" deleted.`, 'info');
                              }
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-error hover:bg-error/15 transition-colors text-left"
                          >
                            <Trash2 size={13} className="flex-shrink-0" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}

          {/* Artists have no home in the comp's sidebar, but they are a real
              destination here and are otherwise only reachable through search.
              They continue the same plain-text pattern under their own label. */}
          {filteredArtists.length > 0 && (
            <li className="pt-2 text-2xs font-bold uppercase tracking-label text-outline">
              Artists
            </li>
          )}
          {filteredArtists.map(artist => {
            const isSelected = currentView === 'artist' && selectedArtistId === artist.id;
            return (
              <li key={artist.id}>
                <button
                  type="button"
                  onClick={() => onSelectArtist(artist.id)}
                  aria-current={isSelected ? 'page' : undefined}
                  title={`${artist.name} — artist`}
                  className={`block w-full text-left text-lg truncate transition-colors ${
                    isSelected ? 'text-primary' : 'text-on-surface-variant hover:text-white'
                  }`}
                >
                  {artist.name}
                </button>
              </li>
            );
          })}

          {filteredPlaylists.length === 0 && filteredArtists.length === 0 && (
            <li className="text-sm text-outline">
              {q ? `Nothing matches “${filterQuery}”.` : 'Your library is empty.'}
            </li>
          )}
        </ul>
      </div>

      {currentUser && (
        <div className="px-[30px] py-4 text-2xs text-outline truncate">
          {currentUser.likedTrackIds?.length || 0} liked &bull; {playlists.length} playlists
        </div>
      )}
    </aside>
  );
};
