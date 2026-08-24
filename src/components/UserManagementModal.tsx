import React, { useState } from 'react';
import { 
  X, 
  User, 
  LogOut, 
  ShieldCheck, 
  Sparkles, 
  Heart, 
  Music, 
  Clock, 
  Mail, 
  Edit3, 
  Check, 
  Camera
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { StorageService } from '../services/storageService';
import { CoverArt } from './CoverArt';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose
}) => {
  const { 
    currentUser, 
    logout, 
    updateUserProfile, 
    sessionDaysRemaining, 
    setIsOnboardingOpen 
  } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(currentUser?.name || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  if (!isOpen || !currentUser) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      await updateUserProfile({
        ...currentUser,
        name: name.trim(),
        bio: bio.trim() || undefined
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const newAvatarUrl = await StorageService.saveImageBlob(`avatar_${currentUser.id}`, file);
      await updateUserProfile({
        ...currentUser,
        avatar: newAvatarUrl
      });
    } catch (err) {
      console.error('Avatar upload failed', err);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleLogout = async () => {
    onClose();
    await logout();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="relative w-full max-w-lg p-6 sm:p-8 rounded-lg bg-surface-container-high shadow-card space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User size={22} className="text-primary" />
            <h2 className="text-xl font-black text-white tracking-tight">Account & Profile</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-on-surface-variant hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* User Card */}
        <div className="p-6 rounded-lg bg-surface-container-high/80 border border-white/5 space-y-6">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            <div className="relative group">
              <CoverArt
                src={currentUser.avatar}
                title={currentUser.name}
                id={currentUser.id}
                loading="eager"
                className="w-20 h-20 rounded-lg object-cover border-2 border-white/20 shadow-lg "
              />
              <label 
                className="absolute inset-0 bg-black/60 rounded-lg flex flex-col items-center justify-center text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
                title="Change Avatar"
              >
                <Camera size={18} className="mb-0.5" />
                <span>{isUploadingAvatar ? 'Saving...' : 'Change'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={isUploadingAvatar}
                  className="hidden"
                />
              </label>
            </div>

            <div className="space-y-1 flex-1 min-w-0">
              <h3 className="text-xl font-bold text-white truncate">{currentUser.name}</h3>
              {currentUser.email && (
                <p className="text-xs text-on-surface-variant flex items-center justify-center sm:justify-start gap-1.5 truncate">
                  <Mail size={12} />
                  <span>{currentUser.email}</span>
                </p>
              )}
              <p className="text-xs text-on-surface-variant italic">
                {currentUser.bio || 'Music streamer & discovery enthusiast.'}
              </p>
            </div>

            <button
              onClick={() => {
                setName(currentUser.name);
                setBio(currentUser.bio || '');
                setIsEditing(!isEditing);
              }}
              className="p-2.5 rounded bg-white/5 hover:bg-white/15 text-on-surface-variant hover:text-white transition-colors"
              title="Edit Profile"
            >
              <Edit3 size={16} />
            </button>
          </div>

          {/* Edit Form */}
          {isEditing && (
            <form onSubmit={handleSaveProfile} className="space-y-3 pt-4 border-t border-white/10 animate-fade-in">
              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded bg-surface-container-high text-white text-xs focus:outline-none focus:border-primary"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">Bio</label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about your music taste..."
                  className="w-full px-3.5 py-2.5 rounded bg-surface-container-high text-white text-xs focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3.5 py-1.5 rounded text-xs font-bold text-on-surface-variant hover:text-white bg-white/5 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 rounded text-xs font-bold text-black bg-primary hover:bg-primary/90 flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Session Status Pill */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded bg-surface-container/60 border border-white/5 flex items-center gap-2.5">
              <ShieldCheck size={18} className="text-emerald-400 flex-shrink-0" />
              <div>
                <div className="text-[11px] font-bold text-white">Google Verified</div>
                <div className="text-[10px] text-on-surface-variant">OAuth 2.0 Auth</div>
              </div>
            </div>

            <div className="p-3 rounded bg-surface-container/60 border border-white/5 flex items-center gap-2.5">
              <Clock size={18} className="text-primary flex-shrink-0" />
              <div>
                <div className="text-[11px] font-bold text-white">{sessionDaysRemaining} Days Left</div>
                <div className="text-[10px] text-on-surface-variant">30-Day Session Cookie</div>
              </div>
            </div>
          </div>
        </div>

        {/* Taste Settings Button */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-surface-container-high/40 border border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-primary/15 text-primary flex items-center justify-center">
              <Sparkles size={20} />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-white">Acoustic Taste Preferences</h4>
              <p className="text-[11px] text-on-surface-variant">
                {currentUser.selectedGenres.length > 0
                  ? currentUser.selectedGenres.join(', ')
                  : 'Customize your genres and vibe affinities'}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              onClose();
              setIsOnboardingOpen(true);
            }}
            className="px-3.5 py-1.5 rounded text-xs font-bold text-primary hover:bg-primary/10 border border-white/10 transition-colors"
          >
            Update
          </button>
        </div>

        {/* Footer with Logout */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <span className="text-[11px] text-on-surface-variant">
            Gaana-Bajao Cloud v1.0
          </span>

          <button
            onClick={handleLogout}
            className="px-4 py-2.5 rounded text-xs font-bold text-error bg-error/10 hover:bg-error/20 border border-error/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>

      </div>
    </div>
  );
};
