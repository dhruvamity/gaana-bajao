import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, 
  X, 
  Check, 
  Activity, 
  FileAudio,
  FolderPlus,
  Plus,
  Trash2,
  AlertCircle,
  Disc3,
  ImageIcon
} from 'lucide-react';
import { Track, AcousticAttributes, Playlist } from '../types';
import { AudioEngine } from '../services/audioEngine';
import { StorageService } from '../services/storageService';
import { DatabaseService } from '../services/firebase';
import { extractAudioMetadata, ExtractedMetadata } from '../services/metadataService';
import { useAuth } from '../context/AuthContext';
import { slugifyArtistId } from '../utils/artistId';

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
  genre: string;
  duration: number;
  acoustics: AcousticAttributes;
  isAnalyzing: boolean;
  status: 'idle' | 'uploading' | 'done' | 'error';
  errorMessage?: string;
  // Per-track cover extracted from ID3
  coverDataUrl: string | null;
  coverBlob: Blob | null;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onTrackUploaded,
  onPlaylistCreated
}) => {
  const { currentUser } = useAuth();

  const [queue, setQueue] = useState<QueuedTrack[]>([]);
  const [globalGenre, setGlobalGenre] = useState('');
  const [globalTags, setGlobalTags] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string>('');

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

  // Object URLs created for artwork previews must be revoked explicitly or the
  // underlying image blobs stay pinned in memory for the page's lifetime.
  const revokePreview = (url?: string | null) => {
    if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
  };

  // Track every preview URL created, so unmount can release them all.
  const previewUrlsRef = useRef<Set<string>>(new Set());
  const trackPreview = (url?: string | null) => {
    if (url && url.startsWith('blob:')) previewUrlsRef.current.add(url);
    return url;
  };

  useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

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

  // Handle multi-file selection — extract ID3 metadata + acoustic analysis
  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newItems: QueuedTrack[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const rawName = file.name.replace(/\.[^/.]+$/, '');
      
      // Filename-based fallback parsing (Artist - Title)
      let fallbackArtist = currentUser.name || 'Unknown Artist';
      let fallbackTitle = rawName;
      if (rawName.includes(' - ')) {
        const parts = rawName.split(' - ');
        fallbackArtist = parts[0].trim();
        fallbackTitle = parts.slice(1).join(' - ').trim();
      }

      const tempId = `queue_${Date.now()}_${i}`;
      newItems.push({
        id: tempId,
        file,
        title: fallbackTitle,
        artist: fallbackArtist,
        album: 'Single',
        genre: '',
        duration: 0,
        acoustics: {
          tempo: 120,
          energy: 0.7,
          valence: 0.5,
          danceability: 0.6,
          acousticness: 0.2,
          key: 'C Major'
        },
        isAnalyzing: true,
        status: 'idle',
        coverDataUrl: null,
        coverBlob: null
      });
    }

    setQueue(prev => [...prev, ...newItems]);

    // Extract metadata and acoustics in parallel for each track
    for (const item of newItems) {
      try {
        // Run ID3 metadata extraction and acoustic analysis concurrently
        const [metadata, analysis] = await Promise.all([
          extractAudioMetadata(item.file),
          AudioEngine.getAudioDurationAndAcoustics(item.file)
        ]);

        setQueue(prev =>
          prev.map(q => {
            if (q.id !== item.id) return q;

            // ID3 metadata takes priority over filename-parsed values
            const updatedTitle = metadata.title || q.title;
            const updatedArtist = metadata.artist || q.artist;
            const updatedAlbum = metadata.album || q.album;
            const updatedGenre = metadata.genre || q.genre;
            // Prefer metadata duration, fallback to acoustic analysis duration
            const updatedDuration = metadata.duration || analysis.duration;

            return {
              ...q,
              title: updatedTitle,
              artist: updatedArtist,
              album: updatedAlbum,
              genre: updatedGenre,
              duration: updatedDuration,
              acoustics: analysis.acoustics,
              coverDataUrl: trackPreview(metadata.coverDataUrl) ?? null,
              coverBlob: metadata.coverBlob,
              isAnalyzing: false
            };
          })
        );
      } catch (err) {
        console.warn('Analysis fallback for:', item.file.name, err);
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
    setCoverPreviewUrl(prev => {
      revokePreview(prev);
      return trackPreview(URL.createObjectURL(file)) as string;
    });
  };

  const handleRemoveQueued = (id: string) => {
    setQueue(prev => {
      const removed = prev.find(item => item.id === id);
      revokePreview(removed?.coverDataUrl);
      previewUrlsRef.current.delete(removed?.coverDataUrl ?? '');
      return prev.filter(item => item.id !== id);
    });
  };

  const handleUpdateQueuedItem = (id: string, field: 'title' | 'artist' | 'album' | 'genre', value: string) => {
    setQueue(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Determine effective cover: manual upload > first track's embedded art > none
  const getEffectiveCoverPreview = (): string => {
    if (coverPreviewUrl) return coverPreviewUrl;
    const firstWithCover = queue.find(q => q.coverDataUrl);
    if (firstWithCover?.coverDataUrl) return firstWithCover.coverDataUrl;
    return '';
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

      // 1. Upload global cover art to Cloudinary (if manually provided)
      let globalCoverUrl = '';
      if (coverFile) {
        globalCoverUrl = await StorageService.saveImageBlob(`cover_batch_${Date.now()}`, coverFile);
      }

      const uploadedTracks: Track[] = [];
      const tagsArray = globalTags.split(',').map(t => t.trim()).filter(Boolean);

      // 2. Process each audio file
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploading' } : q));

        const trackId = `track_${Date.now()}_${i}`;

        // Upload audio to Cloudinary
        const finalAudioUrl = await StorageService.saveAudioBlob(trackId, item.file);

        // Cover priority: the track's OWN embedded artwork first, then a
        // manually chosen cover as a fallback for tracks that have none.
        //
        // The manual cover used to win outright, which meant uploading an album
        // replaced every song's real artwork with one image.
        let trackCoverUrl = '';
        if (item.coverBlob) {
          trackCoverUrl = await StorageService.saveImageBlob(`cover_${trackId}`, item.coverBlob);
        }
        if (!trackCoverUrl) {
          trackCoverUrl = globalCoverUrl;
        }
        // No embedded artwork and no manual cover: leave this empty. The UI
        // generates a cover unique to the track, which keeps a library of
        // untagged files visually distinguishable instead of assigning every
        // track the same stock photo.

        
        // Use per-track genre if set, otherwise global, otherwise fallback
        const trackGenre = item.genre || globalGenre || 'Music';

        const newTrack: Track = {
          id: trackId,
          title: item.title.trim() || 'Untitled Track',
          artist: item.artist.trim() || currentUser.name,
          artistId: slugifyArtistId(item.artist.trim() || currentUser.name),
          ownerId: currentUser.id,
          ownerName: currentUser.name,
          album: item.album.trim() || 'Single',
          duration: item.duration || 180,
          audioUrl: finalAudioUrl,
          coverUrl: trackCoverUrl,
          genre: trackGenre,
          tags: tagsArray,
          acoustics: item.acoustics,
          createdAt: Date.now(),
          playCount: 0,
          saveCount: 0,
          skipCount: 0,
          earlyVelocity: 0,
          frictionScore: 0,
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
        // Use the first track's cover as playlist cover
        const playlistCover = globalCoverUrl || uploadedTracks[0]?.coverUrl || '';

        const newPlaylist: Playlist = {
          id: `pl_${Date.now()}`,
          title: newPlaylistTitle.trim(),
          description: newPlaylistDescription.trim() || `Collection of ${uploadedTracks.length} tracks`,
          coverUrl: playlistCover,
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
        setCoverFile(null);
        setCoverPreviewUrl('');
        setGlobalGenre('');
        setGlobalTags('');
        setNewPlaylistTitle('');
        setNewPlaylistDescription('');
        setPlaylistMode('none');
        setOverallProgress(0);
        setIsProcessingBatch(false);
        onClose();
      }, 1200);

    } catch (err: any) {
      console.error('Batch upload error', err);
      setError(err.message || 'Failed to complete upload. Check Cloudinary settings.');
      setIsProcessingBatch(false);
    }
  };

  const effectiveCover = getEffectiveCoverPreview();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto">
      <div className="relative w-full max-w-2xl max-h-[90vh] my-auto flex flex-col rounded-lg bg-surface-container-high shadow-card overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-surface-container-high/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-primary/20 text-primary flex items-center justify-center">
              <UploadCloud size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Upload Music</h2>
              <p className="text-xs text-on-surface-variant">
                ID3 metadata & cover art auto-extracted • Bulk upload supported
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
        <form onSubmit={handleSubmitBatch} className="p-6 space-y-5 overflow-y-auto flex-1">
          
          {/* Error & Success Messages */}
          {error && (
            <div className="p-3.5 rounded bg-error/15 border border-error/30 text-error text-xs flex items-center gap-2">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successCount !== null && (
            <div className="p-3.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <Check size={16} className="flex-shrink-0" />
              <span>Successfully uploaded and cataloged {successCount} tracks!</span>
            </div>
          )}

          {/* 1. Drop Zone */}
          <div className="relative border-2 border-dashed border-white/15 hover:border-primary/60 rounded-lg p-6 text-center transition-all bg-surface-container-high/30 group cursor-pointer">
            <input
              type="file"
              multiple
              accept="audio/*"
              disabled={isProcessingBatch}
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-lg bg-white/5 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileAudio size={24} />
              </div>
              <div className="text-sm font-bold text-white">
                Drop audio files here, or <span className="text-primary underline">browse</span>
              </div>
              <div className="text-xs text-on-surface-variant">
                MP3, WAV, FLAC, M4A, OGG — ID3 tags & album art auto-extracted
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
                  {queue.filter(q => q.isAnalyzing).length > 0 ? 'Reading metadata...' : 'Ready to upload'}
                </span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {queue.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3 rounded bg-surface-container-high/70 border border-white/5 flex items-center gap-3"
                  >
                    {/* Per-track cover thumbnail */}
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white/5">
                      {item.coverDataUrl ? (
                        <img src={item.coverDataUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
                          <Disc3 size={18} />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-0.5">
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
                          placeholder="Artist"
                          className="text-[11px] text-on-surface-variant bg-transparent border-b border-transparent focus:border-primary/50 focus:outline-none max-w-[120px]"
                        />
                        <span>•</span>
                        <input
                          type="text"
                          value={item.album}
                          disabled={isProcessingBatch}
                          onChange={(e) => handleUpdateQueuedItem(item.id, 'album', e.target.value)}
                          placeholder="Album"
                          className="text-[11px] text-on-surface-variant bg-transparent border-b border-transparent focus:border-primary/50 focus:outline-none max-w-[100px]"
                        />
                        {item.duration > 0 && (
                          <>
                            <span>•</span>
                            <span>{Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, '0')}</span>
                          </>
                        )}
                        {item.acoustics.tempo > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-primary">{item.acoustics.tempo} BPM</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.isAnalyzing ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
                          <Activity size={13} className="animate-spin" />
                          <span>Reading</span>
                        </div>
                      ) : item.status === 'uploading' ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-primary">
                          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          <span>Uploading</span>
                        </div>
                      ) : item.status === 'done' ? (
                        <div className="flex items-center gap-1 text-[11px] text-emerald-400">
                          <Check size={14} />
                          <span>Done</span>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-on-surface-variant block mb-1.5">Global Genre Override</label>
              <input
                type="text"
                value={globalGenre}
                disabled={isProcessingBatch}
                onChange={(e) => setGlobalGenre(e.target.value)}
                placeholder="Leave empty to use per-track ID3 genre"
                className="w-full px-3.5 py-2.5 rounded bg-surface-container-high border border-white/10 text-white text-xs focus:outline-none focus:border-primary placeholder-on-surface-variant/50"
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
                className="w-full px-3.5 py-2.5 rounded bg-surface-container-high border border-white/10 text-white text-xs focus:outline-none focus:border-primary placeholder-on-surface-variant/50"
              />
            </div>
          </div>

          {/* Cover Art — shows extracted or manual */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-surface-container-high/40 border border-white/5">
            <div className="w-16 h-16 rounded overflow-hidden border border-white/10 shadow-md flex-shrink-0 bg-white/5 flex items-center justify-center">
              {effectiveCover ? (
                <img src={effectiveCover} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <Disc3 size={24} className="text-on-surface-variant" />
              )}
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <h4 className="text-xs font-bold text-white">Cover Artwork</h4>
              <p className="text-[11px] text-on-surface-variant">
                {coverFile
                  ? 'Used only for tracks with no embedded artwork of their own.'
                  : effectiveCover
                    ? 'Auto-extracted from the file\u2019s ID3 tags.'
                    : 'No embedded artwork found. Upload a cover, or one will be generated per track.'}
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

          {/* 4. Playlist Attachment */}
          <div className="space-y-3 p-4 rounded-lg bg-surface-container-high/40 border border-white/5">
            <h3 className="text-xs font-bold uppercase text-on-surface-variant tracking-wider flex items-center gap-2">
              <FolderPlus size={15} className="text-primary" />
              <span>Playlist Attachment</span>
            </h3>

            <div className="grid grid-cols-3 gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setPlaylistMode('none')}
                className={`py-2 px-3 rounded border text-center transition-all cursor-pointer ${
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
                className={`py-2 px-3 rounded border text-center transition-all cursor-pointer ${
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
                className={`py-2 px-3 rounded border text-center transition-all cursor-pointer ${
                  playlistMode === 'new'
                    ? 'bg-primary text-black border-primary'
                    : 'bg-surface-container border-white/10 text-on-surface-variant hover:text-white'
                }`}
              >
                + New Playlist
              </button>
            </div>

            {playlistMode === 'existing' && (
              <div className="pt-2">
                <label className="text-xs font-bold text-on-surface-variant block mb-1">
                  Choose Destination Playlist
                </label>
                {existingPlaylists.length > 0 ? (
                  <select
                    value={selectedPlaylistId}
                    onChange={(e) => setSelectedPlaylistId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded bg-surface-container-high text-white text-xs focus:outline-none focus:border-primary"
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

            {playlistMode === 'new' && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">
                    New Playlist Name
                  </label>
                  <input
                    type="text"
                    value={newPlaylistTitle}
                    onChange={(e) => setNewPlaylistTitle(e.target.value)}
                    placeholder="e.g. Road Trip Bangers"
                    className="w-full px-3.5 py-2.5 rounded bg-surface-container-high text-white text-xs focus:outline-none focus:border-primary"
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
                    className="w-full px-3.5 py-2.5 rounded bg-surface-container-high text-white text-xs focus:outline-none focus:border-primary"
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
              className="px-5 py-2.5 rounded-lg text-xs font-bold text-on-surface-variant hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isProcessingBatch || queue.length === 0}
              className="px-6 py-2.5 rounded-lg text-xs font-extrabold text-black bg-primary hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 shadow-lg transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
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
