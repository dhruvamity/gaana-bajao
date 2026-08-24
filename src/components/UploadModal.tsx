import React, { useState, useEffect } from 'react';
import { 
  UploadCloud, 
  X, 
  Sparkles, 
  Check, 
  Activity, 
  Music, 
  Image as ImageIcon, 
  Clock, 
  Zap, 
  Flame, 
  FileAudio,
  FolderPlus,
  ListPlus,
  Plus,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { Track, AcousticAttributes, Playlist } from '../types';
import { AudioEngine } from '../services/audioEngine';
import { StorageService } from '../services/storageService';
import { DatabaseService } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTrackUploaded: (track: Track) => void;
  onPlaylistCreated?: (playlist: Playlist) => void;
}

interface QueuedTrack {
  id: string;
  file: File;
  title: string;
  artist: string;
  album: string;
  duration: number;
  acoustics: AcousticAttributes;
  isAnalyzing: boolean;
  status: 'idle' | 'uploading' | 'done' | 'error';
  errorMessage?: string;
}

const DEFAULT_COVER_GRADIENTS = [
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
];

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onTrackUploaded,
  onPlaylistCreated
}) => {
  const { currentUser } = useAuth();

  const [queue, setQueue] = useState<QueuedTrack[]>([]);
  const [globalGenre, setGlobalGenre] = useState('Electronic');
  const [globalTags, setGlobalTags] = useState('Chill, Focus');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string>(DEFAULT_COVER_GRADIENTS[0]);

  // Playlist Attachment Options
  const [playlistMode, setPlaylistMode] = useState<'none' | 'existing' | 'new'>('none');
  const [existingPlaylists, setExistingPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('');
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [newPlaylistDescription, setNewPlaylistDescription] = useState('');

  // Upload state
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  // Load existing user playlists on open
  useEffect(() => {
    if (isOpen) {
      DatabaseService.getPlaylists().then(playlists => {
        setExistingPlaylists(playlists);
        if (playlists.length > 0) {
          setSelectedPlaylistId(playlists[0].id);
        }
      });
      setError(null);
      setSuccessCount(null);
    }
  }, [isOpen]);

  if (!isOpen || !currentUser) return null;

  // Handle multi-file selection
  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newItems: QueuedTrack[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const rawName = file.name.replace(/\.[^/.]+$/, '');
      let parsedArtist = currentUser.name || 'Artist';
      let parsedTitle = rawName;

      if (rawName.includes(' - ')) {
        const parts = rawName.split(' - ');
        parsedArtist = parts[0].trim();
        parsedTitle = parts.slice(1).join(' - ').trim();
      }

      const tempId = `queue_${Date.now()}_${i}`;
      newItems.push({
        id: tempId,
        file,
        title: parsedTitle,
        artist: parsedArtist,
        album: 'Single',
        duration: 180,
        acoustics: {
          tempo: 120,
          energy: 0.7,
          valence: 0.5,
          danceability: 0.6,
          acousticness: 0.2,
          key: 'C Major'
        },
        isAnalyzing: true,
        status: 'idle'
      });
    }

    setQueue(prev => [...prev, ...newItems]);

    // Analyze acoustics in background for each track
    for (const item of newItems) {
      try {
        const analysis = await AudioEngine.getAudioDurationAndAcoustics(item.file);
        setQueue(prev =>
          prev.map(q =>
            q.id === item.id
              ? {
                  ...q,
                  duration: analysis.duration,
                  acoustics: analysis.acoustics,
                  isAnalyzing: false
                }
              : q
          )
        );
      } catch (err) {
        console.warn('Acoustic analysis fallback for:', item.title, err);
        setQueue(prev =>
          prev.map(q => (q.id === item.id ? { ...q, isAnalyzing: false } : q))
        );
      }
    }
  };

  const handleCoverSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveQueued = (id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateQueuedItem = (id: string, field: 'title' | 'artist' | 'album', value: string) => {
    setQueue(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Submit and Upload All
  const handleSubmitBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (queue.length === 0) {
      setError('Please add at least one audio file.');
      return;
    }

    try {
      setIsProcessingBatch(true);
      setError(null);

      // 1. Upload Cover Art to Cloudinary (if provided)
      let finalCoverUrl = coverPreviewUrl;
      if (coverFile) {
        finalCoverUrl = await StorageService.saveImageBlob(`cover_batch_${Date.now()}`, coverFile);
      }

      const uploadedTracks: Track[] = [];
      const tagsArray = globalTags.split(',').map(t => t.trim()).filter(Boolean);

      // 2. Process each audio file
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        
        // Update item status
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploading' } : q));

        const trackId = `track_${Date.now()}_${i}`;
        const finalAudioUrl = await StorageService.saveAudioBlob(trackId, item.file);

        const artistKey = item.artist.toLowerCase().replace(/\s+/g, '-');
        const newTrack: Track = {
          id: trackId,
          title: item.title.trim() || 'Untitled Track',
          artist: item.artist.trim() || currentUser.name,
          artistId: artistKey,
          album: item.album.trim() || 'Single',
          duration: item.duration,
          audioUrl: finalAudioUrl,
          coverUrl: finalCoverUrl,
          genre: globalGenre,
          tags: tagsArray,
          acoustics: item.acoustics,
          createdAt: Date.now(),
          playCount: 1,
          saveCount: 1,
          skipCount: 0,
          earlyVelocity: 8.0,
          frictionScore: 12.0,
          recommendationReason: '🔥 Fresh Upload'
        };

        await DatabaseService.saveTrack(newTrack);
        uploadedTracks.push(newTrack);
        onTrackUploaded(newTrack);

        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'done' } : q));
        setOverallProgress(Math.round(((i + 1) / queue.length) * 100));
      }

      // 3. Handle Playlist Attachment
      const uploadedTrackIds = uploadedTracks.map(t => t.id);

      if (playlistMode === 'existing' && selectedPlaylistId) {
        for (const trackId of uploadedTrackIds) {
          await DatabaseService.addTrackToPlaylist(selectedPlaylistId, trackId);
        }
      } else if (playlistMode === 'new' && newPlaylistTitle.trim()) {
        const newPlaylist: Playlist = {
          id: `pl_${Date.now()}`,
          title: newPlaylistTitle.trim(),
          description: newPlaylistDescription.trim() || `Uploaded collection of ${uploadedTracks.length} tracks`,
          coverUrl: finalCoverUrl,
          trackIds: uploadedTrackIds,
          ownerId: currentUser.id,
          ownerName: currentUser.name,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        await DatabaseService.savePlaylist(newPlaylist);
        if (onPlaylistCreated) {
          onPlaylistCreated(newPlaylist);
        }
      }

      setSuccessCount(uploadedTracks.length);
      setTimeout(() => {
        setQueue([]);
        setIsProcessingBatch(false);
        onClose();
      }, 1200);

    } catch (err: any) {
      console.error('Batch upload error', err);
      setError(err.message || 'Failed to complete upload. Check Cloudinary settings.');
      setIsProcessingBatch(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-xl overflow-y-auto">
      <div className="relative w-full max-w-2xl max-h-[90vh] my-auto flex flex-col rounded-3xl bg-surface-container border border-white/10 shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-surface-container-high/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
              <UploadCloud size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Bulk Music Uploader</h2>
              <p className="text-xs text-on-surface-variant">
                Upload multiple songs to Cloudinary & auto-attach to playlists
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessingBatch}
            className="p-2 text-on-surface-variant hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmitBatch} className="p-6 space-y-6 overflow-y-auto flex-1">
          
          {/* Error & Success Messages */}
          {error && (
            <div className="p-3.5 rounded-xl bg-error/15 border border-error/30 text-error text-xs flex items-center gap-2">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successCount !== null && (
            <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <Check size={16} className="flex-shrink-0" />
              <span>Successfully uploaded and cataloged {successCount} tracks!</span>
            </div>
          )}

          {/* 1. Drag & Drop Multi-file Zone */}
          <div className="relative border-2 border-dashed border-white/15 hover:border-primary/60 rounded-2xl p-6 text-center transition-all bg-surface-container-high/30 group cursor-pointer">
            <input
              type="file"
              multiple
              accept="audio/*"
              disabled={isProcessingBatch}
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-white/5 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileAudio size={24} />
              </div>
              <div className="text-sm font-bold text-white">
                Drop multiple audio files here, or <span className="text-primary underline">browse</span>
              </div>
              <div className="text-xs text-on-surface-variant">
                Supports MP3, WAV, FLAC, M4A, OGG • Instant Web Audio Acoustic Analysis
              </div>
            </div>
          </div>

          {/* 2. Track Queue List */}
          {queue.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase text-on-surface-variant tracking-wider">
                  Queued Tracks ({queue.length})
                </h3>
                <span className="text-xs text-primary font-medium">
                  {queue.filter(q => q.isAnalyzing).length > 0 ? 'Analyzing acoustics...' : 'Ready to upload'}
                </span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {queue.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-surface-container-high/70 border border-white/5 flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 w-full sm:w-auto">
                      <span className="text-xs font-bold text-on-surface-variant w-5">
                        {idx + 1}.
                      </span>
                      <div className="space-y-1 flex-1 min-w-0">
                        <input
                          type="text"
                          value={item.title}
                          disabled={isProcessingBatch}
                          onChange={(e) => handleUpdateQueuedItem(item.id, 'title', e.target.value)}
                          placeholder="Song Title"
                          className="w-full text-xs font-bold text-white bg-transparent border-b border-transparent focus:border-primary/50 focus:outline-none"
                        />
                        <div className="flex items-center gap-2 text-[11px] text-on-surface-variant">
                          <input
                            type="text"
                            value={item.artist}
                            disabled={isProcessingBatch}
                            onChange={(e) => handleUpdateQueuedItem(item.id, 'artist', e.target.value)}
                            placeholder="Artist Name"
                            className="text-[11px] text-on-surface-variant bg-transparent border-b border-transparent focus:border-primary/50 focus:outline-none"
                          />
                          <span>•</span>
                          <span>{Math.round(item.duration)}s</span>
                          <span>•</span>
                          <span className="text-primary">{item.acoustics.tempo} BPM</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {item.isAnalyzing ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
                          <Activity size={13} className="animate-spin" />
                          <span>Analyzing</span>
                        </div>
                      ) : item.status === 'uploading' ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-primary">
                          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          <span>Uploading</span>
                        </div>
                      ) : item.status === 'done' ? (
                        <div className="flex items-center gap-1 text-[11px] text-emerald-400">
                          <Check size={14} />
                          <span>Saved</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isProcessingBatch}
                          onClick={() => handleRemoveQueued(item.id)}
                          className="p-1.5 text-on-surface-variant hover:text-error rounded-lg hover:bg-white/5 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Global Metadata & Artwork */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="text-xs font-bold text-on-surface-variant block mb-1.5">Genre</label>
              <input
                type="text"
                value={globalGenre}
                disabled={isProcessingBatch}
                onChange={(e) => setGlobalGenre(e.target.value)}
                placeholder="e.g. Synthwave, Electronic, Lo-Fi"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-high border border-white/10 text-white text-xs focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-on-surface-variant block mb-1.5">Mood / Vibe Tags</label>
              <input
                type="text"
                value={globalTags}
                disabled={isProcessingBatch}
                onChange={(e) => setGlobalTags(e.target.value)}
                placeholder="e.g. Focus, Chill, Late Night, Workout"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-high border border-white/10 text-white text-xs focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Cover Art Upload */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface-container-high/40 border border-white/5">
            <img
              src={coverPreviewUrl}
              alt="Cover Preview"
              className="w-16 h-16 rounded-xl object-cover border border-white/10 shadow-md flex-shrink-0"
            />
            <div className="space-y-1 flex-1 min-w-0">
              <h4 className="text-xs font-bold text-white">Cover Artwork (Optional)</h4>
              <p className="text-[11px] text-on-surface-variant">
                Applied to all uploaded tracks or new playlist
              </p>
              <label className="inline-block px-3 py-1 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors mt-1">
                <span>Browse Cover Image</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={isProcessingBatch}
                  onChange={handleCoverSelected}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* 4. Playlist Direct Attachment Selection */}
          <div className="space-y-3 p-4 rounded-2xl bg-surface-container-high/40 border border-white/5">
            <h3 className="text-xs font-bold uppercase text-on-surface-variant tracking-wider flex items-center gap-2">
              <FolderPlus size={15} className="text-primary" />
              <span>Playlist Attachment Options</span>
            </h3>

            <div className="grid grid-cols-3 gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setPlaylistMode('none')}
                className={`py-2 px-3 rounded-xl border text-center transition-all ${
                  playlistMode === 'none'
                    ? 'bg-primary text-black border-primary'
                    : 'bg-surface-container border-white/10 text-on-surface-variant hover:text-white'
                }`}
              >
                Library Only
              </button>

              <button
                type="button"
                onClick={() => setPlaylistMode('existing')}
                className={`py-2 px-3 rounded-xl border text-center transition-all ${
                  playlistMode === 'existing'
                    ? 'bg-primary text-black border-primary'
                    : 'bg-surface-container border-white/10 text-on-surface-variant hover:text-white'
                }`}
              >
                Existing Playlist
              </button>

              <button
                type="button"
                onClick={() => setPlaylistMode('new')}
                className={`py-2 px-3 rounded-xl border text-center transition-all ${
                  playlistMode === 'new'
                    ? 'bg-primary text-black border-primary'
                    : 'bg-surface-container border-white/10 text-on-surface-variant hover:text-white'
                }`}
              >
                + New Playlist
              </button>
            </div>

            {/* Existing Playlist Dropdown */}
            {playlistMode === 'existing' && (
              <div className="pt-2 animate-fade-in">
                <label className="text-xs font-bold text-on-surface-variant block mb-1">
                  Choose Destination Playlist
                </label>
                {existingPlaylists.length > 0 ? (
                  <select
                    value={selectedPlaylistId}
                    onChange={(e) => setSelectedPlaylistId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-white/10 text-white text-xs focus:outline-none focus:border-primary"
                  >
                    {existingPlaylists.map(pl => (
                      <option key={pl.id} value={pl.id} className="bg-surface-container text-white">
                        {pl.title} ({pl.trackIds.length} tracks)
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-xs text-on-surface-variant italic">
                    No playlists created yet. Choose "+ New Playlist" to create one.
                  </div>
                )}
              </div>
            )}

            {/* Create New Playlist Fields */}
            {playlistMode === 'new' && (
              <div className="space-y-3 pt-2 animate-fade-in">
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">
                    New Playlist Name
                  </label>
                  <input
                    type="text"
                    value={newPlaylistTitle}
                    onChange={(e) => setNewPlaylistTitle(e.target.value)}
                    placeholder="e.g. Midnight Cyberpunk Sessions"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-white/10 text-white text-xs focus:outline-none focus:border-primary"
                    required={playlistMode === 'new'}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={newPlaylistDescription}
                    onChange={(e) => setNewPlaylistDescription(e.target.value)}
                    placeholder="A brief description of this collection..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-white/10 text-white text-xs focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Batch Progress Bar */}
          {isProcessingBatch && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-white">
                <span>Uploading to Cloudinary & Saving...</span>
                <span>{overallProgress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessingBatch}
              className="px-5 py-2.5 rounded-2xl text-xs font-bold text-on-surface-variant hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isProcessingBatch || queue.length === 0}
              className="px-6 py-2.5 rounded-2xl text-xs font-extrabold text-black bg-primary hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-primary/20 transition-all cursor-pointer hover:scale-102 active:scale-98"
            >
              {isProcessingBatch ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Uploading {queue.length} Tracks...</span>
                </>
              ) : (
                <>
                  <UploadCloud size={16} />
                  <span>Upload & Catalog ({queue.length})</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
