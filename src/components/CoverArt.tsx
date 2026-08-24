import React, { useMemo, useState, useEffect } from 'react';
import { resolveCoverUrl, isPlaceholderCover, CoverArtSeed } from '../utils/coverArt';

interface CoverArtProps extends CoverArtSeed {
  /** The stored artwork URL, if the track has one. */
  src?: string | null;
  alt?: string;
  className?: string;
  /** Rendered pixel size hint for the generated fallback. */
  size?: number;
  loading?: 'lazy' | 'eager';
}

/**
 * Renders track/playlist artwork with a guaranteed result.
 *
 * Real embedded artwork is used when present. Otherwise — and whenever a stored
 * URL fails to load, which happens with expired Cloudinary links and rotated
 * Google avatars — it falls back to a cover generated deterministically from the
 * track's own identity, so every item still looks distinct.
 */
export const CoverArt: React.FC<CoverArtProps> = ({
  src,
  title,
  artist,
  id,
  alt,
  className,
  size = 600,
  loading = 'lazy'
}) => {
  const fallback = useMemo(
    () => resolveCoverUrl({ title, artist, id, coverUrl: null }, size),
    [title, artist, id, size]
  );

  const initial = !isPlaceholderCover(src) ? (src as string) : fallback;
  const [resolved, setResolved] = useState<string>(initial);

  // Re-evaluate when the track changes underneath a reused DOM node.
  useEffect(() => {
    setResolved(initial);
  }, [initial]);

  return (
    <img
      src={resolved}
      alt={alt ?? title ?? ''}
      className={className}
      loading={loading}
      draggable={false}
      onError={() => {
        if (resolved !== fallback) setResolved(fallback);
      }}
    />
  );
};
