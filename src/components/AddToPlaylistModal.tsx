import React, { useState, useEffect } from 'react';
import { X, Plus, Check, Music, FolderPlus } from 'lucide-react';
import { Playlist, Track } from '../types';
import { DatabaseService } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { CoverArt } from './CoverArt';

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
  onOpenCreatePlaylist?: () => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  isOpen,
  onClose,
  track,
  onOpenCreatePlaylist
}) => {
  const { currentUser } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [addedPlaylistIds, setAddedPlaylistIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen || !track) return;

    DatabaseService.getPlaylists().then(allPlaylists => {
      setPlaylists(allPlaylists);
      const containing = allPlaylists
        .filter(p => p.trackIds.includes(track.id))
        .map(p => p.id);
      setAddedPlaylistIds(containing);
      setLoading(false);
    });
  }, [isOpen, track]);

  if (!isOpen || !track) return null;

  const handleToggleTrackInPlaylist = async (playlist: Playlist) => {
    const isAlreadyIn = addedPlaylistIds.includes(playlist.id);

    if (isAlreadyIn) {
      await DatabaseService.removeTrackFromPlaylist(playlist.id, track.id);
      setAddedPlaylistIds(prev => prev.filter(id => id !== playlist.id));
    } else {
      await DatabaseService.addTrackToPlaylist(playlist.id, track.id);
      setAddedPlaylistIds(prev => [...prev, playlist.id]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-surface-container-high rounded-lg p-6 shadow-card space-y-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-primary/20 text-primary border border-white/10 flex items-center justify-center">
              <FolderPlus size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Add to Playlist</h2>
              <p className="text-xs text-on-surface-variant truncate max-w-[200px]">
                {track.title} • {track.artist}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 text-on-surface-variant hover:text-white transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Create New Playlist Quick Action */}
        <button
          onClick={() => {
            onClose();
            if (onOpenCreatePlaylist) onOpenCreatePlaylist();
          }}
          className="w-full p-3 rounded-lg bg-primary/15 hover:bg-primary/25 border border-white/10 text-primary font-bold text-xs flex items-center justify-center gap-2 transition-all hover:scale-102"
        >
          <Plus size={16} />
          <span>New Playlist with this Track</span>
        </button>

        {/* Playlists List */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
            Your Playlists
          </span>

          {loading ? (
            <div className="py-8 text-center text-xs text-on-surface-variant">Loading playlists...</div>
          ) : playlists.length === 0 ? (
            <div className="py-8 text-center bg-white/5 rounded-lg text-xs text-on-surface-variant">
              No playlists found. Create one above!
            </div>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {playlists.map((playlist) => {
                const isSelected = addedPlaylistIds.includes(playlist.id);

                return (
                  <button
                    key={playlist.id}
                    onClick={() => handleToggleTrackInPlaylist(playlist)}
                    className={`w-full p-2.5 rounded border flex items-center justify-between transition-all group ${
                      isSelected
                        ? 'bg-primary/20 border-white/20 text-white'
                        : 'bg-surface-container border-white/5 hover:border-primary/30 text-on-surface-variant hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CoverArt
                        src={playlist.coverUrl}
                        title={playlist.title}
                        artist={playlist.ownerName}
                        id={playlist.id}
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="text-left min-w-0">
                        <h4 className="text-xs font-bold text-white truncate">{playlist.title}</h4>
                        <p className="text-[10px] text-on-surface-variant truncate">
                          {playlist.trackIds.length} tracks • {playlist.ownerName}
                        </p>
                      </div>
                    </div>

                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
                      isSelected 
                        ? 'bg-primary text-on-primary border-primary' 
                        : 'border-white/20 text-transparent group-hover:border-white/40'
                    }`}>
                      <Check size={13} strokeWidth={3} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded bg-primary text-on-primary font-bold text-xs shadow-md hover:scale-105 active:scale-95 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
