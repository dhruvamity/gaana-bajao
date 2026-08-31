import React, { useState, useEffect, useRef } from 'react';
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
  Check,
  ImagePlus,
  Loader2,
  RotateCcw
} from 'lucide-react';
import { Playlist, Track } from '../types';
import { DatabaseService } from '../services/firebase';
import { StorageService } from '../services/storageService';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { CoverArt } from './CoverArt';
import { PlaylistCover } from './PlaylistCover';
import { getCoverTint, isPlaceholderCover } from '../utils/coverArt';

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
  const { playTrack, playOrToggle, currentTrack, isPlaying, isShuffle, toggleShuffle, logInteraction, addToQueue } = useAudio();
  const { currentUser, toggleLikeTrack } = useAuth();

  const [currentPlaylist, setCurrentPlaylist] = useState<Playlist>(playlist);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [allCatalogTracks, setAllCatalogTracks] = useState<Track[]>([]);
  const [copiedShare, setCopiedShare] = useState<boolean>(false);
  const [isAddTracksOpen, setIsAddTracksOpen] = useState<boolean>(false);
  const [trackSearchQuery, setTrackSearchQuery] = useState<string>('');

  const coverInputRef = useRef<HTMLInputElement>(null);
  const [coverBusy, setCoverBusy] = useState<boolean>(false);
  const [coverError, setCoverError] = useState<string | null>(null);

  const hasCustomCover = !isPlaceholderCover(currentPlaylist.coverUrl);

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

  /** The comp's "DATE ADDED" column. Tracks predating the field show nothing
   *  rather than "Jan 1970". */
  const formatAdded = (ts?: number) => {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Header tint follows the artwork, so the page reads as one object.
  const heroTint = getCoverTint({
    title: currentPlaylist.title,
    artist: currentPlaylist.ownerName,
    id: currentPlaylist.id
  });

  const availableToAdd = allCatalogTracks.filter(t => 
    !currentPlaylist.trackIds.includes(t.id) &&
    (t.title.toLowerCase().includes(trackSearchQuery.toLowerCase()) || 
     t.artist.toLowerCase().includes(trackSearchQuery.toLowerCase()))
  );

  /* Custom artwork. Clearing it does not delete the uploaded image — unsigned
     Cloudinary uploads cannot be removed from the client — it just stops the
     playlist pointing at it, so the collage takes over again. */
  const MAX_COVER_BYTES = 5 * 1024 * 1024;

  const persistCover = async (coverUrl: string) => {
    const updated: Playlist = { ...currentPlaylist, coverUrl, updatedAt: Date.now() };
    await DatabaseService.savePlaylist(updated);
    setCurrentPlaylist(updated);
  };

  const handleCoverSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';                 // so re-picking the same file still fires
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setCoverError('That file is not an image.');
      return;
    }
    if (file.size > MAX_COVER_BYTES) {
      setCoverError('Cover images must be under 5 MB.');
      return;
    }

    setCoverBusy(true);
    setCoverError(null);
    try {
      const url = await StorageService.saveImageBlob(`playlist_cover_${currentPlaylist.id}`, file);
      await persistCover(url);
    } catch (err: any) {
      setCoverError(err?.message || 'Could not upload that image.');
    } finally {
      setCoverBusy(false);
    }
  };

  const handleResetCover = async () => {
    setCoverBusy(true);
    setCoverError(null);
    try {
      await persistCover('');
    } catch (err: any) {
      setCoverError(err?.message || 'Could not reset the cover.');
    } finally {
      setCoverBusy(false);
    }
  };

  return (
    <div className="relative -mt-header pb-8">
      {/* Hero: a full-bleed wash tinted from the artwork, running up behind the
          sticky top bar so the page reads as one object. The back control now
          lives in that bar, so there is no second one here. */}
      <section
        className="relative px-6 lg:px-8 pt-header pb-6"
        style={{ background: `linear-gradient(180deg, ${heroTint} 0%, rgba(18,18,18,.6) 70%, #121212 100%)` }}
      >
        <div className="flex flex-col md:flex-row items-center md:items-end gap-6 pt-8">
        <div className="group relative w-48 h-48 md:w-[232px] md:h-[232px] rounded overflow-hidden shadow-card flex-shrink-0">
          <PlaylistCover
            playlist={currentPlaylist}
            tracks={allCatalogTracks}
            loading="eager"
            className="w-full h-full object-cover"
          />

          {/* Cover editing. Revealed on hover, and on keyboard focus so it is
              reachable without a pointer. */}
          {isOwnerOrCollaborator && (
            <>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverSelected}
              />

              <div
                className={`absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 transition-opacity ${
                  coverBusy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                }`}
              >
                {coverBusy ? (
                  <>
                    <Loader2 size={26} className="text-white animate-spin" />
                    <span className="text-2xs font-bold uppercase tracking-label text-white">
                      Uploading
                    </span>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      className="flex flex-col items-center gap-1.5 text-white"
                    >
                      <ImagePlus size={26} />
                      <span className="text-2xs font-bold uppercase tracking-label">
                        {hasCustomCover ? 'Replace cover' : 'Choose cover'}
                      </span>
                    </button>

                    {hasCustomCover && (
                      <button
                        type="button"
                        onClick={handleResetCover}
                        className="mt-1 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-label text-on-surface-variant hover:text-white transition-colors"
                        title="Go back to the collage of this playlist's first four tracks"
                      >
                        <RotateCcw size={13} />
                        <span>Use track collage</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className="min-w-0 flex-1 text-center md:text-left">
          {coverError && (
            <p role="alert" className="mb-2 text-sm font-semibold text-red-300">
              {coverError}
            </p>
          )}
          <span className="text-2xs font-bold uppercase tracking-label text-white">
            {currentPlaylist.isAlgorithmic ? 'Curated playlist' : 'Public playlist'}
          </span>

          {/* Scales down for long titles instead of truncating them. */}
          <h1 className="font-extrabold text-white tracking-display mt-3 mb-4 break-words [font-size:clamp(2rem,5.5vw,6rem)] [line-height:1.05]">
            {currentPlaylist.title}
          </h1>

          {currentPlaylist.description && (
            <p className="text-sm text-on-surface-variant max-w-xl line-clamp-2">
              {currentPlaylist.description}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 text-sm text-white pt-2">
            <span className="font-bold">{currentPlaylist.ownerName}</span>
            <span className="text-on-surface-variant">&bull;</span>
            <span className="text-on-surface-variant">{tracks.length} songs, {totalMinutes} min</span>

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

        </div>
      </section>

      {/* Action bar */}
      <div className="px-6 py-6 flex items-center gap-6">
          <button
            onClick={() => tracks.length > 0 && playTrack(tracks[0], tracks)}
            className="w-16 h-16 rounded-full bg-primary hover:bg-primary-fixed text-on-primary flex items-center justify-center shadow-play hover:scale-105 transition-transform"
            title="Play"
            aria-label={`Play ${currentPlaylist.title}`}
          >
            <Play size={28} fill="currentColor" className="ml-1" />
          </button>

          <button
            onClick={() => {
              if (tracks.length === 0) return;
              // Turn shuffle ON rather than toggling: pressing "shuffle play"
              // while shuffle was already on used to switch it off.
              if (!isShuffle) toggleShuffle();
              const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
              playTrack(randomTrack, tracks);
            }}
            className={`p-2 transition-colors ${isShuffle ? 'text-primary' : 'text-on-surface-variant hover:text-white'}`}
            title="Shuffle play"
            aria-label="Shuffle play"
            aria-pressed={isShuffle}
          >
            <Shuffle size={26} />
          </button>

          {isOwnerOrCollaborator && (
            <button
              onClick={() => setIsAddTracksOpen(!isAddTracksOpen)}
              className={`p-2 transition-colors ${
                isAddTracksOpen ? 'text-primary' : 'text-on-surface-variant hover:text-white'
              }`}
              title="Add tracks"
              aria-label="Add tracks"
              aria-expanded={isAddTracksOpen}
            >
              <Plus size={26} />
            </button>
          )}

          <button
            onClick={handleShare}
            className="p-2 text-on-surface-variant hover:text-white transition-colors relative"
            title="Share playlist"
            aria-label="Share playlist"
          >
            <Share2 size={22} />
            {copiedShare && (
              <span className="absolute -top-8 right-0 bg-white text-black px-2 py-0.5 rounded text-2xs font-bold whitespace-nowrap">
                Copied!
              </span>
            )}
          </button>
      </div>

      {/* Add Tracks Drawer */}
      {isAddTracksOpen && (
        <section className="mx-6 mb-6 p-6 rounded-lg bg-surface-container space-y-4 animate-in fade-in slide-in-from-top-2">
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
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface-container text-white text-xs placeholder-on-surface-variant focus:outline-none focus:border-primary"
            />
          </div>

          <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))] max-h-52 overflow-y-auto pr-1">
            {availableToAdd.map(t => (
              <div
                key={t.id}
                className="p-2.5 rounded-lg bg-surface-container flex items-center justify-between gap-3"
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
      <section className="px-6">
        {/* Column header, as in a Spotify track table */}
        {tracks.length > 0 && (
          <div className="grid grid-cols-[16px_4fr_2fr_minmax(80px,1fr)] xl:grid-cols-[16px_4fr_3fr_2fr_minmax(80px,1fr)] gap-4 px-4 pb-2 mb-2 border-b border-white/10 text-2xs uppercase tracking-label text-on-surface-variant">
            <span className="text-right">#</span>
            <span>Title</span>
            <span className="hidden sm:block">Album</span>
            <span className="hidden xl:block">Date added</span>
            <span className="flex items-center justify-end pr-12"><Clock size={14} /></span>
          </div>
        )}

        {tracks.length === 0 ? (
          <div className="p-12 text-center rounded-lg bg-surface-container space-y-2">
            <Music size={32} className="mx-auto text-on-surface-variant opacity-40" />
            <p className="text-sm font-semibold text-white">No tracks in this playlist</p>
            {isOwnerOrCollaborator && (
              <button
                onClick={() => setIsAddTracksOpen(true)}
                className="mt-3 px-6 py-2.5 rounded-full bg-white hover:scale-105 text-black font-bold text-sm inline-flex items-center gap-1.5 transition-transform"
              >
                <Plus size={16} />
                <span>Add songs</span>
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
                onDoubleClick={() => playOrToggle(track, tracks)}
                className={`group grid grid-cols-[16px_4fr_2fr_minmax(80px,1fr)] xl:grid-cols-[16px_4fr_3fr_2fr_minmax(80px,1fr)] gap-4 items-center px-4 py-2 rounded transition-colors hover:bg-white/10 ${
                  isTrackActive ? 'bg-white/10' : ''
                }`}
              >
                {/* Index becomes a play control on hover, as in Spotify */}
                <div className="relative w-4 text-right">
                  <span className={`text-base tabular-nums group-hover:opacity-0 transition-opacity ${
                    isTrackActive ? 'text-primary' : 'text-on-surface-variant'
                  }`}>
                    {idx + 1}
                  </span>
                  <button
                    onClick={() => playOrToggle(track, tracks)}
                    className="absolute inset-0 flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity text-white"
                    title={isTrackActive && isPlaying ? 'Pause' : 'Play'}
                    aria-label={`${isTrackActive && isPlaying ? 'Pause' : 'Play'} ${track.title}`}
                  >
                    {isTrackActive && isPlaying
                      ? <Pause size={14} fill="currentColor" />
                      : <Play size={14} fill="currentColor" />}
                  </button>
                </div>

                <div className="flex items-center gap-3 min-w-0">
                  <CoverArt
                    src={track.coverUrl}
                    title={track.title}
                    artist={track.artist}
                    id={track.id}
                    className="w-10 h-10 rounded object-cover flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <h4 className={`text-base truncate ${isTrackActive ? 'text-primary' : 'text-white'}`}>
                      {track.title}
                    </h4>
                    <button
                      type="button"
                      onClick={() => track.artistId && onSelectArtist && onSelectArtist(track.artistId)}
                      className="block max-w-full text-sm text-on-surface-variant hover:text-white hover:underline transition-colors truncate text-left"
                    >
                      {track.artist}
                    </button>
                  </div>
                </div>

                <span className="hidden sm:block text-sm text-on-surface-variant truncate">
                  {track.album || track.genre}
                </span>

                <span className="hidden xl:block text-sm text-on-surface-variant truncate tabular-nums">
                  {formatAdded(track.createdAt)}
                </span>

                <div className="flex items-center justify-end gap-1.5">
                  {/* Add to other playlist */}
                  {onOpenAddToPlaylist && (
                    <button
                      onClick={() => onOpenAddToPlaylist(track)}
                      className="p-2 rounded-full text-on-surface-variant hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Add to another playlist"
                      aria-label="Add to another playlist"
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
                    className={`p-2 rounded-full transition-opacity ${
                      isLiked ? 'text-primary opacity-100' : 'text-on-surface-variant hover:text-white opacity-0 group-hover:opacity-100'
                    }`}
                    title={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
                    aria-label={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
                    aria-pressed={isLiked}
                  >
                    <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
                  </button>

                  <span className="text-sm text-on-surface-variant tabular-nums w-10 text-right">
                    {formatDuration(track.duration)}
                  </span>

                  {/* Remove from this playlist */}
                  {isOwnerOrCollaborator && (
                    <button
                      onClick={(e) => handleRemoveTrack(e, track.id)}
                      className="p-2 rounded-full text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove from playlist"
                      aria-label={`Remove ${track.title} from this playlist`}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}

                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
};
