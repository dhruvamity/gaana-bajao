import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Plus, 
  Search, 
  Music, 
  Users, 
  Clock, 
  Trash2, 
  Sparkles,
  Library,
  MoreVertical,
  Edit3,
  Share2
} from 'lucide-react';
import { Playlist, Track } from '../types';
import { DatabaseService, onTracksChanged } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useAudio } from '../context/AudioContext';
import { CoverArt } from './CoverArt';
import { PlaylistCover } from './PlaylistCover';
import { showToast } from './Toast';

interface PlaylistsDirectoryViewProps {
  onSelectPlaylist: (playlist: Playlist) => void;
  onOpenCreatePlaylist: () => void;
  onOpenEditPlaylist?: (playlist: Playlist) => void;
}

export const PlaylistsDirectoryView: React.FC<PlaylistsDirectoryViewProps> = ({
  onSelectPlaylist,
  onOpenCreatePlaylist,
  onOpenEditPlaylist
}) => {
  const { currentUser } = useAuth();
  const { playTrack } = useAudio();

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'created' | 'collaborative' | 'algorithmic'>('all');
  const [activeMenuPlaylistId, setActiveMenuPlaylistId] = useState<string | null>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  const loadPlaylists = async () => {
    const [pls, tracks] = await Promise.all([
      DatabaseService.getPlaylists(),
      DatabaseService.getTracks()
    ]);
    setPlaylists(pls);
    setAllTracks(tracks);
  };

  useEffect(() => {
    loadPlaylists();
    const unsubscribe = onTracksChanged(() => {
      loadPlaylists();
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!activeMenuPlaylistId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setActiveMenuPlaylistId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenuPlaylistId]);

  const handleDeletePlaylist = async (e: React.MouseEvent, playlist: Playlist) => {
    e.stopPropagation();
    setActiveMenuPlaylistId(null);
    if (window.confirm(`Are you sure you want to delete "${playlist.title}"?`)) {
      await DatabaseService.deletePlaylist(playlist.id);
      setPlaylists(prev => prev.filter(p => p.id !== playlist.id));
      showToast(`Playlist "${playlist.title}" deleted.`, 'info');
    }
  };

  const handleSharePlaylist = (e: React.MouseEvent, playlist: Playlist) => {
    e.stopPropagation();
    setActiveMenuPlaylistId(null);
    navigator.clipboard?.writeText(window.location.href);
    showToast(`Link to "${playlist.title}" copied to clipboard!`, 'info');
  };

  const handleQuickPlay = (e: React.MouseEvent, playlist: Playlist) => {
    e.stopPropagation();
    const playlistTracks = playlist.trackIds
      .map(id => allTracks.find(t => t.id === id))
      .filter((t): t is Track => Boolean(t));

    if (playlistTracks.length > 0) {
      playTrack(playlistTracks[0], playlistTracks);
    }
  };

  const filteredPlaylists = playlists.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.ownerName.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'created') return p.ownerId === currentUser?.id;
    if (filterType === 'collaborative') return Boolean(p.collaborators && p.collaborators.length > 0);

    return true;
  });

  return (
    <div className="space-y-8 pb-32 max-w-7xl mx-auto px-4 sm:px-8 pt-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Library className="text-primary" size={32} />
            <span>Playlists & Library</span>
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
            Browse, curate, and collaborate on shared music playlists.
          </p>
        </div>

        <button
          onClick={onOpenCreatePlaylist}
          className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-fixed text-on-primary font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>New Playlist</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search playlists..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface-container text-white text-xs placeholder-on-surface-variant focus:outline-none focus:border-primary"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              filterType === 'all'
                ? 'bg-primary text-on-primary shadow-sm font-bold'
                : 'bg-white/5 text-on-surface-variant hover:text-white'
            }`}
          >
            All ({playlists.length})
          </button>
          <button
            onClick={() => setFilterType('created')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              filterType === 'created'
                ? 'bg-primary text-on-primary shadow-sm font-bold'
                : 'bg-white/5 text-on-surface-variant hover:text-white'
            }`}
          >
            By You
          </button>
          <button
            onClick={() => setFilterType('collaborative')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              filterType === 'collaborative'
                ? 'bg-primary text-on-primary shadow-sm font-bold'
                : 'bg-white/5 text-on-surface-variant hover:text-white'
            }`}
          >
            Collaborative
          </button>
        </div>
      </div>

      {/* Playlists Grid */}
      {filteredPlaylists.length === 0 ? (
        <div className="p-16 text-center rounded-lg bg-white/5 border border-white/5 space-y-3">
          <Music size={40} className="mx-auto text-on-surface-variant opacity-40" />
          <h3 className="text-base font-bold text-white">No playlists found</h3>
          <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
            {searchQuery ? 'Try adjusting your search query.' : 'Create your first playlist to get started!'}
          </p>
          <button
            onClick={onOpenCreatePlaylist}
            className="px-5 py-2 rounded bg-primary text-on-primary font-bold text-xs shadow-md mt-2 inline-flex items-center gap-1.5"
          >
            <Plus size={15} />
            <span>Create Playlist</span>
          </button>
        </div>
      ) : (
        <div ref={menuContainerRef} className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]">
          {filteredPlaylists.map((playlist) => {
            const isOwner = playlist.ownerId === currentUser?.id;
            const isCollaborator = playlist.collaborators?.some(c => c.id === currentUser?.id);
            const canEdit = !playlist.isAlgorithmic && (isOwner || isCollaborator);
            const isMenuOpen = activeMenuPlaylistId === playlist.id;

            return (
              <div
                key={playlist.id}
                onClick={() => onSelectPlaylist(playlist)}
                className="group relative p-4 rounded-lg bg-surface-container hover:border-primary/30 hover:bg-white/5 transition-all duration-300 flex flex-col justify-between cursor-pointer"
              >
                {/* Artwork with Hover Play Button */}
                <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-3 shadow-lg group">
                  <PlaylistCover
                    playlist={playlist}
                    tracks={allTracks}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={(e) => handleQuickPlay(e, playlist)}
                      className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-xl shadow-primary/40 hover:scale-110 active:scale-95 transition-transform"
                      title="Play Playlist"
                    >
                      <Play size={20} fill="currentColor" className="ml-0.5" />
                    </button>
                  </div>

                  {/* Algorithmic or Collaborative Badge */}
                  <div className="absolute top-2.5 left-2.5">
                    {playlist.isAlgorithmic ? (
                      <span className="bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold text-primary flex items-center gap-1">
                        <Sparkles size={10} /> Curated
                      </span>
                    ) : playlist.collaborators && playlist.collaborators.length > 0 ? (
                      <span className="bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold text-tertiary flex items-center gap-1">
                        <Users size={10} /> Shared
                      </span>
                    ) : null}
                  </div>

                  {/* Three-dots menu button */}
                  <div className="absolute top-2.5 right-2.5 z-20">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuPlaylistId(isMenuOpen ? null : playlist.id);
                      }}
                      className={`p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-all shadow-md ${
                        isMenuOpen ? 'opacity-100 bg-black/80' : 'opacity-0 group-hover:opacity-100'
                      }`}
                      title="Playlist options"
                      aria-label="Playlist options"
                    >
                      <MoreVertical size={14} />
                    </button>

                    {/* Options Dropdown */}
                    {isMenuOpen && (
                      <div 
                        className="absolute right-0 top-full mt-1.5 w-44 rounded-xl bg-surface-container-high border border-white/10 shadow-2xl p-1 z-30 animate-in fade-in zoom-in-95 duration-150"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {canEdit && onOpenEditPlaylist && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuPlaylistId(null);
                              onOpenEditPlaylist(playlist);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-white hover:bg-white/10 transition-colors text-left"
                          >
                            <Edit3 size={14} className="text-primary flex-shrink-0" />
                            <span>Edit Details</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => handleSharePlaylist(e, playlist)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-white hover:bg-white/10 transition-colors text-left"
                        >
                          <Share2 size={14} className="text-on-surface-variant flex-shrink-0" />
                          <span>Share Playlist</span>
                        </button>

                        {!playlist.isAlgorithmic && isOwner && (
                          <button
                            type="button"
                            onClick={(e) => handleDeletePlaylist(e, playlist)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-error hover:bg-error/15 transition-colors text-left"
                          >
                            <Trash2 size={14} className="flex-shrink-0" />
                            <span>Delete Playlist</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Playlist Info */}
                <div className="min-w-0 space-y-1">
                  <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-primary transition-colors truncate">
                    {playlist.title}
                  </h3>
                  <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                    {playlist.description}
                  </p>
                </div>

                {/* Metadata Footer */}
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/5 text-[11px] text-on-surface-variant">
                  <span className="font-medium text-white/80 truncate max-w-[120px]">
                    {playlist.ownerName}
                  </span>

                  <div className="flex items-center gap-2">
                    {playlist.collaborators && (
                      <div className="flex items-center -space-x-1.5">
                        {playlist.collaborators.slice(0, 3).map((c) => (
                          <CoverArt
                            key={c.id}
                            src={c.avatar}
                            title={c.name}
                            id={c.id}
                            className="w-4 h-4 rounded-full object-cover ring-1 ring-background"
                          />
                        ))}
                      </div>
                    )}
                    <span>{playlist.trackIds.length} tracks</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
