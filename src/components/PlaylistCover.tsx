import React, { useMemo } from 'react';
import { Playlist, Track } from '../types';
import { CoverArt } from './CoverArt';
import { isPlaceholderCover } from '../utils/coverArt';

/** The playlist fields artwork actually depends on. */
export type PlaylistCoverSeed = Pick<
  Playlist,
  'id' | 'title' | 'ownerName' | 'coverUrl' | 'trackIds'
>;

interface PlaylistCoverProps {
  playlist: PlaylistCoverSeed;
  /**
   * The catalogue to resolve `trackIds` against. Without it the component
   * still renders — it just cannot build a collage, so it falls through to the
   * generated cover rather than issuing a fetch of its own.
   */
  tracks?: Track[];
  /** Applied to the outer element, whichever variant renders. */
  className?: string;
  /** Rendered pixel size hint, used to size generated fallbacks. */
  size?: number;
  loading?: 'lazy' | 'eager';
}

/** How many tiles a full collage uses. */
const COLLAGE_TILES = 4;

/**
 * A playlist's artwork, in order of precedence:
 *
 *  1. A custom cover the owner uploaded.
 *  2. A 2x2 collage of the first four tracks' artwork.
 *  3. The first track's artwork, when the playlist holds one to three songs —
 *     a collage of two or three tiles would leave visible holes.
 *  4. A cover generated from the playlist's own identity, when it is empty.
 *
 * Every tile goes through CoverArt, so a track carrying no embedded artwork
 * still contributes its own deterministic generated cover instead of a gap,
 * and a tile whose stored URL has expired repairs itself on error.
 */
export const PlaylistCover: React.FC<PlaylistCoverProps> = ({
  playlist,
  tracks,
  className = '',
  size = 600,
  loading = 'lazy'
}) => {
  const hasCustomCover = !isPlaceholderCover(playlist.coverUrl);

  /* Resolved in playlist order, not catalogue order: the collage should show
     the first four songs someone actually added. */
  const collage = useMemo<Track[]>(() => {
    if (hasCustomCover || !tracks?.length || !playlist.trackIds?.length) return [];
    const byId = new Map(tracks.map(t => [t.id, t]));
    const picked: Track[] = [];
    for (const id of playlist.trackIds) {
      const track = byId.get(id);
      if (!track) continue;                       // id refers to a deleted track
      picked.push(track);
      if (picked.length === COLLAGE_TILES) break;
    }
    return picked;
  }, [hasCustomCover, tracks, playlist.trackIds]);

  if (hasCustomCover) {
    return (
      <CoverArt
        src={playlist.coverUrl}
        title={playlist.title}
        artist={playlist.ownerName}
        id={playlist.id}
        alt={playlist.title}
        className={className}
        size={size}
        loading={loading}
      />
    );
  }

  if (collage.length === COLLAGE_TILES) {
    return (
      <div
        role="img"
        aria-label={`${playlist.title} — cover made from its first four tracks`}
        className={`grid grid-cols-2 grid-rows-2 overflow-hidden ${className}`}
      >
        {collage.map(track => (
          <CoverArt
            key={track.id}
            src={track.coverUrl}
            title={track.title}
            artist={track.artist}
            id={track.id}
            alt=""
            /* Each tile is a quarter of the finished artwork, so generated
               fallbacks are rendered at the size they are actually shown. */
            size={Math.round(size / 2)}
            loading={loading}
            className="w-full h-full object-cover"
          />
        ))}
      </div>
    );
  }

  // One to three tracks: lead with the first. Empty: seed on the playlist.
  const lead = collage[0];
  return (
    <CoverArt
      src={lead?.coverUrl}
      title={lead ? lead.title : playlist.title}
      artist={lead ? lead.artist : playlist.ownerName}
      id={lead ? lead.id : playlist.id}
      alt={playlist.title}
      className={className}
      size={size}
      loading={loading}
    />
  );
};
