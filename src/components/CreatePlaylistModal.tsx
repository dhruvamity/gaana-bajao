import React, { useState, useEffect } from 'react';
import { X, Plus, Music, Sparkles, Image as ImageIcon } from 'lucide-react';
import { Playlist, PublicProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { DatabaseService } from '../services/firebase';
import { CoverArt } from './CoverArt';

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaylistCreated: (playlist: Playlist) => void;
  initialTrackId?: string;
}

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({
  isOpen,
  onClose,
  onPlaylistCreated,
  initialTrackId
}) => {
  const { currentUser } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [isCollaborative, setIsCollaborative] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<PublicProfile[]>([]);
  const [selectedCollaboratorIds, setSelectedCollaboratorIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    // Reads the public directory (name + avatar), not the users collection.
    // The previous call pulled every user's full profile into the browser.
    let cancelled = false;
    DatabaseService.getPublicProfiles().then(profiles => {
      if (!cancelled) setAvailableUsers(profiles);
    });
    return () => { cancelled = true; };
  }, [isOpen]);

  if (!isOpen || !currentUser) return null;

  const defaultCovers = [
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSaving(true);

    // Empty means "generate a cover from the playlist identity" — deterministic
    // and unique, rather than one of five stock images shared across playlists.
    const chosenCover = coverUrl.trim();
    const collaborators = isCollaborative
      ? availableUsers
          .filter(u => u.id === currentUser.id || selectedCollaboratorIds.includes(u.id))
          .map(u => ({ id: u.id, name: u.name, avatar: u.avatar }))
      : undefined;

    // Security rules cannot project a field out of an array of maps, so they
    // gate collaborator writes on this flat list. It was never being written,
    // which would have made every collaborative playlist read-only for its
    // collaborators the moment the rules were deployed.
    const collaboratorIds = collaborators?.map(c => c.id);

    const newPlaylist: Playlist = {
      id: `pl-${Date.now()}`,
      title: title.trim(),
      description: description.trim() || 'Custom playlist created on Gaana-Bajao',
      coverUrl: chosenCover,
      trackIds: initialTrackId ? [initialTrackId] : [],
      ownerId: currentUser.id,
      ownerName: currentUser.name,
      collaborators,
      collaboratorIds,
      isAlgorithmic: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await DatabaseService.savePlaylist(newPlaylist);
    setIsSaving(false);
    onPlaylistCreated(newPlaylist);
    onClose();
  };

  const toggleCollaborator = (userId: string) => {
    setSelectedCollaboratorIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-surface-container-high rounded-lg p-6 sm:p-8 shadow-card space-y-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-primary/20 text-primary border border-white/10 flex items-center justify-center">
              <Plus size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Create New Playlist</h2>
              <p className="text-xs text-on-surface-variant">Personal or collaborative playlist</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 text-on-surface-variant hover:text-white transition-all"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-on-surface-variant">Playlist Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Late Night Vibes, Workout Anthems"
              className="w-full px-3.5 py-2.5 rounded bg-surface-container text-white text-xs placeholder-on-surface-variant focus:outline-none focus:border-primary"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-on-surface-variant">Description (Optional)</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What makes this playlist special?"
              className="w-full px-3.5 py-2 rounded bg-surface-container text-white text-xs placeholder-on-surface-variant focus:outline-none focus:border-primary resize-none"
            />
          </div>

          {/* Cover Art URL */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-on-surface-variant">Cover Image URL (Optional)</label>
            <input
              type="url"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://images.unsplash.com/... (or choose below)"
              className="w-full px-3.5 py-2.5 rounded bg-surface-container text-white text-xs placeholder-on-surface-variant focus:outline-none focus:border-primary"
            />

            {/* Quick Cover Palette */}
            <div className="flex items-center gap-2 pt-2">
              <span className="text-[11px] text-on-surface-variant">Quick Covers:</span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {defaultCovers.map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`Cover ${idx}`}
                    onClick={() => setCoverUrl(url)}
                    className={`w-8 h-8 rounded-lg object-cover cursor-pointer hover:scale-110 transition-transform ${
                      coverUrl === url ? 'ring-2 ring-primary' : 'opacity-70 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Collaborative toggle */}
          <div className="p-3.5 rounded-lg bg-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">Collaborative Playlist</h4>
                <p className="text-[11px] text-on-surface-variant">Allow your friends to add & reorder tracks</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCollaborative(!isCollaborative)}
                className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${
                  isCollaborative ? 'bg-primary' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-background shadow-md transition-transform ${
                    isCollaborative ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {isCollaborative && (
              <div className="pt-2 border-t border-white/5 space-y-2">
                <span className="text-[11px] font-semibold text-primary">Select Friends to Collaborate:</span>
                <div className="flex flex-wrap gap-2">
                  {availableUsers.filter(u => u.id !== currentUser.id).map(user => {
                    const isSelected = selectedCollaboratorIds.includes(user.id);
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => toggleCollaborator(user.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium border transition-all ${
                          isSelected 
                            ? 'bg-primary/20 border-primary text-white' 
                            : 'bg-white/5 border-white/10 text-on-surface-variant hover:text-white'
                        }`}
                      >
                        <CoverArt src={user.avatar} title={user.name} id={user.id} className="w-5 h-5 rounded-full object-cover" />
                        <span>{user.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded text-xs font-semibold text-on-surface-variant hover:text-white"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving || !title.trim()}
              className="px-6 py-2.5 rounded bg-primary hover:bg-primary-fixed disabled:opacity-50 text-on-primary font-bold text-xs shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Plus size={15} />
              <span>{isSaving ? 'Creating...' : 'Create Playlist'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
