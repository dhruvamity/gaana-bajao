import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Shuffle, 
  Heart, 
  Share2, 
  Plus, 
  Users, 
  ChevronLeft, 
  Clock, 
  Music, 
  Trash2,
  FolderPlus,
  Search,
  Check
} from 'lucide-react';
import { Playlist, Track } from '../types';
import { DatabaseService } from '../services/firebase';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { CoverArt } from './CoverArt';

interface PlaylistViewProps {
  playlist: Playlist;
  onBack: () => void;
  onSelectArtist?: (artistId: string) => void;
  onOpenAddToPlaylist?: (track: Track) => void;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({ 
  playlist, 
  onBack,
  onSelectArtist,
  onOpenAddToPlaylist
}) => {
  const { playTrack, currentTrack, isPlaying, toggleShuffle, logInteraction, addToQueue } = useAudio();
  const { currentUser, toggleLikeTrack } = useAuth();

  const [currentPlaylist, setCurrentPlaylist] = useState<Playlist>(playlist);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [allCatalogTracks, setAllCatalogTracks] = useState<Track[]>([]);
  const [copiedShare, setCopiedShare] = useState<boolean>(false);
  const [isAddTracksOpen, setIsAddTracksOpen] = useState<boolean>(false);
  const [trackSearchQuery, setTrackSearchQuery] = useState<string>('');

  const isOwnerOrCollaborator = !currentPlaylist.isAlgorithmic && Boolean(
    (currentUser && currentPlaylist.ownerId === currentUser.id) ||
    currentPlaylist.collaborators?.some(c => c.id === currentUser?.id)
  );

  useEffect(() => {
    setCurrentPlaylist(playlist);
  }, [playlist]);

  const loadData = async () => {
    const allTracks = await DatabaseService.getTracks();
    setAllCatalogTracks(allTracks);
    const filtered = currentPlaylist.trackIds
      .map(id => allTracks.find(t => t.id === id))
      .filter((t): t is Track => Boolean(t));
    setTracks(filtered);
  };

  useEffect(() => {
    loadData();
  }, [currentPlaylist]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const totalDurationSeconds = tracks.reduce((acc, t) => acc + t.duration, 0);
  const totalMinutes = Math.floor(totalDurationSeconds / 60);

  const handleShare = () => {
    if (tracks.length > 0) logInteraction('share', tracks[0]?.id);
    navigator.clipboard?.writeText(window.location.href);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  const handleRemoveTrack = async (e: React.MouseEvent, trackId: string) => {
    e.stopPropagation();
    const updated = await DatabaseService.removeTrackFromPlaylist(currentPlaylist.id, trackId);
    if (updated) {
      setCurrentPlaylist(updated);
    }
  };

  const handleAddTrack = async (trackId: string) => {
    const updated = await DatabaseService.addTrackToPlaylist(currentPlaylist.id, trackId);
    if (updated) {
      setCurrentPlaylist(updated);
    }
  };

  const availableToAdd = allCatalogTracks.filter(t => 
    !currentPlaylist.trackIds.includes(t.id) &&
    (t.title.toLowerCase().includes(trackSearchQuery.toLowerCase()) || 
     t.artist.toLowerCase().includes(trackSearchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-8 pb-32 max-w-7xl mx-auto px-4 lg:px-8 pt-4">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-white glass-pill px-3 py-1.5 rounded-full transition-all"
      >
        <ChevronLeft size={16} />
        <span>All Playlists</span>
      </button>

      {/* Playlist Hero Section */}
      <section className="relative overflow-hidden rounded-3xl glass-elevated border border-white/10 p-6 sm:p-8 flex flex-col md:flex-row items-center md:items-end gap-6 sm:gap-8 shadow-2xl">
        <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 group">
          <CoverArt
            src={currentPlaylist.coverUrl}
            title={currentPlaylist.title}
            artist={currentPlaylist.ownerName}
            id={currentPlaylist.id}
            loading="eager"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="space-y-3 min-w-0 flex-1 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 text-primary border border-primary/30 text-xs font-bold uppercase tracking-wider">
            {currentPlaylist.isAlgorithmic ? 'Curated Playlist' : 'Shared Playlist'}
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight truncate">
            {currentPlaylist.title}
          </h1>

          <p className="text-xs sm:text-sm text-on-surface-variant max-w-xl">
            {currentPlaylist.description}
          </p>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs text-on-surface-variant pt-2">
            <span className="font-semibold text-white">{currentPlaylist.ownerName}</span>
            <span>•</span>
            <span>{tracks.length} tracks ({totalMinutes} mins)</span>

            {/* Collaborator Avatars */}
            {currentPlaylist.collaborators && currentPlaylist.collaborators.length > 0 && (
              <div className="flex items-center -space-x-2 ml-2">
                {currentPlaylist.collaborators.map((c) => (
                  <CoverArt
                    key={c.id}
                    src={c.avatar}
                    title={c.name}
                    id={c.id}
                    className="w-6 h-6 rounded-full object-cover ring-2 ring-background"
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Hero Actions */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-center md:justify-end">
          <button
            onClick={() => tracks.length > 0 && playTrack(tracks[0], tracks)}
            className="px-6 py-3 rounded-2xl bg-primary hover:bg-primary-fixed text-on-primary font-bold text-sm flex items-center gap-2 shadow-xl shadow-primary/25 hover:scale-105 active:scale-95 transition-all"
          >
            <Play size={18} fill="#001f2e" />
            <span>Play</span>
          </button>

          <button
            onClick={() => {
              toggleShuffle();
              if (tracks.length > 0) {
                const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
                playTrack(randomTrack, tracks);
              }
            }}
            className="p-3 rounded-2xl glass-pill text-on-surface-variant hover:text-white transition-all"
            title="Shuffle Play"
          >
            <Shuffle size={18} />
          </button>

          {isOwnerOrCollaborator && (
            <button
              onClick={() => setIsAddTracksOpen(!isAddTracksOpen)}
              className={`p-3 rounded-2xl glass-pill transition-all ${
                isAddTracksOpen ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-white'
              }`}
              title="Add Tracks"
            >
              <Plus size={18} />
            </button>
          )}

          <button
            onClick={handleShare}
            className="p-3 rounded-2xl glass-pill text-on-surface-variant hover:text-white transition-all relative"
            title="Share Playlist"
          >
            <Share2 size={18} />
            {copiedShare && (
              <span className="absolute -top-8 right-0 bg-primary text-on-primary px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap shadow-lg">
                Copied!
              </span>
            )}
          </button>
        </div>
      </section>

      {/* Add Tracks Drawer */}
      {isAddTracksOpen && (
        <section className="p-6 rounded-3xl glass-elevated border border-primary/30 space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus size={16} className="text-primary" />
              <span>Add Tracks to "{currentPlaylist.title}"</span>
            </h3>
            <span className="text-xs text-on-surface-variant">{availableToAdd.length} available</span>
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              value={trackSearchQuery}
              onChange={(e) => setTrackSearchQuery(e.target.value)}
              placeholder="Search catalog to add songs..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl glass-panel border border-white/10 text-white text-xs placeholder-on-surface-variant focus:outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-52 overflow-y-auto pr-1">
            {availableToAdd.map(t => (
              <div
                key={t.id}
                className="p-2.5 rounded-2xl glass-panel border border-white/5 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <CoverArt src={t.coverUrl} title={t.title} artist={t.artist} id={t.id} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                  <div className="min-w-0">
                    <h5 className="text-xs font-bold text-white truncate">{t.title}</h5>
                    <p className="text-[10px] text-on-surface-variant truncate">{t.artist}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleAddTrack(t.id)}
                  className="px-2.5 py-1 rounded-lg bg-primary/20 hover:bg-primary text-primary hover:text-on-primary font-bold text-xs transition-all flex items-center gap-1 flex-shrink-0"
                >
                  <Plus size={12} />
                  <span>Add</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Playlist Tracks List */}
      <section className="space-y-2">
        {tracks.length === 0 ? (
          <div className="p-12 text-center rounded-2xl glass-subtle border border-white/5 space-y-2">
            <Music size={32} className="mx-auto text-on-surface-variant opacity-40" />
            <p className="text-sm font-semibold text-white">No tracks in this playlist</p>
            {isOwnerOrCollaborator && (
              <button
                onClick={() => setIsAddTracksOpen(true)}
                className="mt-2 px-4 py-1.5 rounded-xl bg-primary text-on-primary font-bold text-xs inline-flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>Add Songs</span>
              </button>
            )}
          </div>
        ) : (
          tracks.map((track, idx) => {
            const isTrackActive = currentTrack?.id === track.id;
            const isLiked = Boolean(currentUser?.likedTrackIds?.includes(track.id));

            return (
              <div
                key={track.id}
                className={`group p-3 sm:px-4 sm:py-3 rounded-2xl glass-panel border transition-all flex items-center justify-between gap-4 hover:border-primary/30 hover:bg-white/5 ${
                  isTrackActive ? 'border-primary/50 bg-primary/10' : 'border-white/5'
                }`}
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <span className="text-xs font-bold text-on-surface-variant w-4 text-center">
                    {idx + 1}
                  </span>

                  <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-md flex-shrink-0">
                    <CoverArt src={track.coverUrl} title={track.title} artist={track.artist} id={track.id} className="w-full h-full object-cover" />
                    <button
                      onClick={() => playTrack(track, tracks)}
                      className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {isTrackActive && isPlaying ? (
                        <Pause size={16} fill="#ffffff" />
                      ) : (
                        <Play size={16} fill="#ffffff" className="ml-0.5" />
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
                      {track.artist}
                    </p>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-6 text-xs text-on-surface-variant">
                  <span className="glass-pill px-2.5 py-1 rounded-full text-[11px] text-white/80">{track.genre}</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> {formatDuration(track.duration)}</span>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  {/* Add to other playlist */}
                  {onOpenAddToPlaylist && (
                    <button
                      onClick={() => onOpenAddToPlaylist(track)}
                      className="p-2 rounded-full text-on-surface-variant hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                      title="Add to another playlist"
                    >
                      <FolderPlus size={16} />
                    </button>
                  )}

                  {/* Like button */}
                  <button
                    onClick={() => {
                      toggleLikeTrack(track.id);
                      logInteraction(isLiked ? 'unlike' : 'like', track.id);
                    }}
                    className={`p-2 rounded-full transition-all ${
                      isLiked ? 'text-primary' : 'text-on-surface-variant hover:text-white'
                    }`}
                  >
                    <Heart size={16} fill={isLiked ? '#7dd3fc' : 'none'} />
                  </button>

                  {/* Remove from this playlist */}
                  {isOwnerOrCollaborator && (
                    <button
                      onClick={(e) => handleRemoveTrack(e, track.id)}
                      className="p-2 rounded-full text-on-surface-variant hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      title="Remove from playlist"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}

                  <button
                    onClick={() => playTrack(track, tracks)}
                    className="p-2 rounded-xl glass-pill text-primary hover:bg-primary/20 transition-all"
                  >
                    {isTrackActive && isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
};
