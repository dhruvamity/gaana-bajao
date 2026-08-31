import React, { useState, useEffect, useRef } from 'react';
import { X, Edit3, Trash2, ImagePlus, RotateCcw, Users, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { Playlist, PublicProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { DatabaseService } from '../services/firebase';
import { StorageService } from '../services/storageService';
import { CoverArt } from './CoverArt';
import { showToast } from './Toast';

interface EditPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlist: Playlist | null;
  onPlaylistUpdated?: (playlist: Playlist) => void;
  onPlaylistDeleted?: (playlistId: string) => void;
}

export const EditPlaylistModal: React.FC<EditPlaylistModalProps> = ({
  isOpen,
  onClose,
  playlist,
  onPlaylistUpdated,
  onPlaylistDeleted
}) => {
  const { currentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [isCollaborative, setIsCollaborative] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<PublicProfile[]>([]);
  const [selectedCollaboratorIds, setSelectedCollaboratorIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!playlist || !isOpen) return;

    setTitle(playlist.title || '');
    setDescription(playlist.description || '');
    setCoverUrl(playlist.coverUrl || '');
    setIsCollaborative(Boolean(playlist.collaborators && playlist.collaborators.length > 0));
    setSelectedCollaboratorIds(playlist.collaboratorIds || playlist.collaborators?.map(c => c.id) || []);
    setShowDeleteConfirm(false);

    let cancelled = false;
    DatabaseService.getPublicProfiles().then(profiles => {
      if (!cancelled) setAvailableUsers(profiles);
    });
    return () => { cancelled = true; };
  }, [playlist, isOpen]);

  if (!isOpen || !playlist || !currentUser) return null;

  const isOwner = playlist.ownerId === currentUser.id;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG, JPG, WebP).', 'warning');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size must be under 5MB.', 'warning');
      return;
    }

    setIsUploadingCover(true);
    try {
      const uploadedUrl = await StorageService.saveImageBlob(`playlist_cover_${playlist.id}`, file);
      setCoverUrl(uploadedUrl);
      showToast('Cover art uploaded successfully.', 'info');
    } catch (err: any) {
      console.error('Failed to upload cover art', err);
      showToast('Failed to upload cover art. Please try again.', 'error');
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      const collaborators = isCollaborative
        ? availableUsers
            .filter(u => u.id === currentUser.id || selectedCollaboratorIds.includes(u.id))
            .map(u => ({ id: u.id, name: u.name, avatar: u.avatar }))
        : undefined;

      const collaboratorIds = collaborators?.map(c => c.id);

      const updated: Playlist = {
        ...playlist,
        title: title.trim(),
        description: description.trim(),
        coverUrl: coverUrl.trim(),
        collaborators,
        collaboratorIds,
        updatedAt: Date.now()
      };

      await DatabaseService.savePlaylist(updated);
      showToast(`Playlist "${updated.title}" updated!`, 'info');
      if (onPlaylistUpdated) onPlaylistUpdated(updated);
      onClose();
    } catch (err: any) {
      console.error('Failed to save playlist', err);
      showToast('Failed to save playlist changes.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await DatabaseService.deletePlaylist(playlist.id);
      showToast(`Playlist "${playlist.title}" deleted.`, 'info');
      if (onPlaylistDeleted) onPlaylistDeleted(playlist.id);
      onClose();
    } catch (err: any) {
      console.error('Failed to delete playlist', err);
      showToast('Failed to delete playlist.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleCollaborator = (userId: string) => {
    setSelectedCollaboratorIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-surface-container-high rounded-xl p-6 sm:p-8 shadow-card border border-white/10 space-y-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 text-primary border border-white/10 flex items-center justify-center">
              <Edit3 size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Edit Playlist Details</h2>
              <p className="text-xs text-on-surface-variant">Update artwork, metadata, or collaboration</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 text-on-surface-variant hover:text-white transition-all"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Delete Confirmation Alert */}
        {showDeleteConfirm ? (
          <div className="p-4 rounded-xl bg-error/15 border border-error/30 space-y-3 animate-in fade-in">
            <div className="flex items-center gap-2 text-error text-sm font-bold">
              <AlertTriangle size={18} />
              <span>Delete this playlist permanently?</span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              This will remove <strong>"{playlist.title}"</strong> and all collaborator access. Tracks will remain in your catalog.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-error hover:bg-error/90 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
              >
                {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>{isDeleting ? 'Deleting...' : 'Yes, Delete Playlist'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg bg-white/10 text-white font-semibold text-xs hover:bg-white/20 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSave} className="space-y-4">
          {/* Cover Art Preview & Custom Upload */}
          <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl bg-surface-container border border-white/5">
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden flex-shrink-0 shadow-lg group">
              <CoverArt
                src={coverUrl}
                title={title || playlist.title}
                id={playlist.id}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingCover}
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white text-[11px] font-bold cursor-pointer"
              >
                {isUploadingCover ? (
                  <Loader2 size={18} className="animate-spin text-primary" />
                ) : (
                  <>
                    <ImagePlus size={18} />
                    <span>Change</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex-1 space-y-2 text-center sm:text-left w-full">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <h4 className="text-xs font-bold text-white">Playlist Artwork</h4>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Upload a custom image or paste an image URL below.
              </p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingCover}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <ImagePlus size={14} />
                  <span>Upload Image</span>
                </button>
                {coverUrl && (
                  <button
                    type="button"
                    onClick={() => setCoverUrl('')}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-on-surface-variant hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <RotateCcw size={13} />
                    <span>Reset to Collage</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-on-surface-variant">Playlist Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Chill Beats, Workout Anthems"
              className="w-full px-3.5 py-2.5 rounded-lg bg-surface-container text-white text-xs placeholder-on-surface-variant focus:outline-none focus:border-primary border border-white/5"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-on-surface-variant">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add an optional description"
              className="w-full px-3.5 py-2 rounded-lg bg-surface-container text-white text-xs placeholder-on-surface-variant focus:outline-none focus:border-primary border border-white/5 resize-none"
            />
          </div>

          {/* Cover Art URL Input */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-on-surface-variant">Cover Image URL (Direct Link)</label>
            <input
              type="url"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className="w-full px-3.5 py-2.5 rounded-lg bg-surface-container text-white text-xs placeholder-on-surface-variant focus:outline-none focus:border-primary border border-white/5"
            />
          </div>

          {/* Collaborative toggle */}
          {isOwner && !playlist.isAlgorithmic && (
            <div className="p-3.5 rounded-xl bg-white/5 space-y-3 border border-white/5">
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
                  <span className="text-[11px] font-semibold text-primary">Collaborators:</span>
                  <div className="flex flex-wrap gap-2">
                    {availableUsers.filter(u => u.id !== currentUser.id).map(user => {
                      const isSelected = selectedCollaboratorIds.includes(user.id);
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => toggleCollaborator(user.id)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            isSelected 
                              ? 'bg-primary/20 border-primary text-white font-bold' 
                              : 'bg-white/5 border-white/10 text-on-surface-variant hover:text-white'
                          }`}
                        >
                          <CoverArt src={user.avatar} title={user.name} id={user.id} className="w-5 h-5 rounded-full object-cover" />
                          <span>{user.name}</span>
                          {isSelected && <Check size={12} className="text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
            {isOwner && !playlist.isAlgorithmic && !showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3.5 py-2 rounded-lg bg-error/10 hover:bg-error/20 text-error text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Trash2 size={14} />
                <span>Delete Playlist</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-white transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving || !title.trim()}
                className="px-6 py-2.5 rounded-lg bg-primary hover:bg-primary-fixed disabled:opacity-50 text-on-primary font-bold text-xs shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
