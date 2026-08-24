import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Plus, 
  Search, 
  Music, 
  Users, 
  Clock, 
  Trash2, 
  Sparkles,
  Library
} from 'lucide-react';
import { Playlist, Track } from '../types';
import { DatabaseService } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useAudio } from '../context/AudioContext';
import { CoverArt } from './CoverArt';

interface PlaylistsDirectoryViewProps {
  onSelectPlaylist: (playlist: Playlist) => void;
  onOpenCreatePlaylist: () => void;
}

export const PlaylistsDirectoryView: React.FC<PlaylistsDirectoryViewProps> = ({
  onSelectPlaylist,
  onOpenCreatePlaylist
}) => {
  const { currentUser } = useAuth();
  const { playTrack } = useAudio();

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'created' | 'collaborative' | 'algorithmic'>('all');

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
  }, []);

  const handleDeletePlaylist = async (e: React.MouseEvent, playlistId: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this playlist?')) {
      await DatabaseService.deletePlaylist(playlistId);
      setPlaylists(prev => prev.filter(p => p.id !== playlistId));
    }
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
          className="px-5 py-2.5 rounded-2xl bg-primary hover:bg-primary-fixed text-on-primary font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all self-start sm:self-auto"
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
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl glass-panel border border-white/10 text-white text-xs placeholder-on-surface-variant focus:outline-none focus:border-primary"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              filterType === 'all'
                ? 'bg-primary text-on-primary shadow-sm font-bold'
                : 'glass-subtle text-on-surface-variant hover:text-white'
            }`}
          >
            All ({playlists.length})
          </button>
          <button
            onClick={() => setFilterType('created')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              filterType === 'created'
                ? 'bg-primary text-on-primary shadow-sm font-bold'
                : 'glass-subtle text-on-surface-variant hover:text-white'
            }`}
          >
            By You
          </button>
          <button
            onClick={() => setFilterType('collaborative')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              filterType === 'collaborative'
                ? 'bg-primary text-on-primary shadow-sm font-bold'
                : 'glass-subtle text-on-surface-variant hover:text-white'
            }`}
          >
            Collaborative
          </button>
        </div>
      </div>

      {/* Playlists Grid */}
      {filteredPlaylists.length === 0 ? (
        <div className="p-16 text-center rounded-3xl glass-subtle border border-white/5 space-y-3">
          <Music size={40} className="mx-auto text-on-surface-variant opacity-40" />
          <h3 className="text-base font-bold text-white">No playlists found</h3>
          <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
            {searchQuery ? 'Try adjusting your search query.' : 'Create your first playlist to get started!'}
          </p>
          <button
            onClick={onOpenCreatePlaylist}
            className="px-5 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs shadow-md mt-2 inline-flex items-center gap-1.5"
          >
            <Plus size={15} />
            <span>Create Playlist</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredPlaylists.map((playlist) => {
            const isOwner = playlist.ownerId === currentUser?.id;

            return (
              <div
                key={playlist.id}
                onClick={() => onSelectPlaylist(playlist)}
                className="group relative p-4 rounded-3xl glass-panel border border-white/5 hover:border-primary/30 hover:bg-white/5 transition-all duration-300 flex flex-col justify-between cursor-pointer"
              >
                {/* Artwork with Hover Play Button */}
                <div className="relative aspect-square w-full rounded-2xl overflow-hidden mb-3 shadow-lg group">
                  <CoverArt
                    src={playlist.coverUrl}
                    title={playlist.title}
                    artist={playlist.ownerName}
                    id={playlist.id}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={(e) => handleQuickPlay(e, playlist)}
                      className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-xl shadow-primary/40 hover:scale-110 active:scale-95 transition-transform"
                      title="Play Playlist"
                    >
                      <Play size={20} fill="#001f2e" className="ml-0.5" />
                    </button>
                  </div>

                  {/* Algorithmic or Collaborative Badge */}
                  <div className="absolute top-2.5 left-2.5">
                    {playlist.isAlgorithmic ? (
                      <span className="glass-pill px-2 py-0.5 rounded text-[10px] font-bold text-primary flex items-center gap-1">
                        <Sparkles size={10} /> Curated
                      </span>
                    ) : playlist.collaborators && playlist.collaborators.length > 0 ? (
                      <span className="glass-pill px-2 py-0.5 rounded text-[10px] font-bold text-tertiary flex items-center gap-1">
                        <Users size={10} /> Shared
                      </span>
                    ) : null}
                  </div>

                  {/* Delete Playlist button for custom playlists */}
                  {!playlist.isAlgorithmic && isOwner && (
                    <button
                      onClick={(e) => handleDeletePlaylist(e, playlist.id)}
                      className="absolute top-2.5 right-2.5 p-1.5 rounded-full glass-subtle text-on-surface-variant hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete Playlist"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
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
