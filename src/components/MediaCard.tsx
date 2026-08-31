import React from 'react';
import { Play, Pause } from 'lucide-react';
import { CoverArt } from './CoverArt';

interface MediaCardProps {
  /** Identity for the generated-artwork fallback. */
  id: string;
  title: string;
  subtitle?: string;
  coverUrl?: string | null;
  artist?: string;
  /** Artists are drawn as circles in the comp; everything else is a square. */
  shape?: 'square' | 'circle';
  onOpen: () => void;
  /** Omitted for cards with nothing playable behind them. */
  onPlay?: () => void;
  /** Keeps the button visible and showing a pause glyph. */
  isPlaying?: boolean;
  /** Tints the title, marking the card the player is currently on. */
  isCurrent?: boolean;
  /** Rendered under the title row — the like/add controls on track cards. */
  footer?: React.ReactNode;
}

/**
 * The standard content tile.
 *
 * Figma: 224x324 at `white/4%` and 8px radius, a 182px square of artwork at
 * 4px radius, a 20px bold title over a subdued subtitle, and a 62px green play
 * button that fades up from the artwork on hover.
 *
 * The whole tile opens the item and the play button plays it — two actions in
 * one card. That is expressed with a stretched overlay button rather than by
 * nesting a button inside a button, which is invalid HTML and which React was
 * warning about in the previous implementation.
 */
export const MediaCard: React.FC<MediaCardProps> = ({
  id,
  title,
  subtitle,
  coverUrl,
  artist,
  shape = 'square',
  onOpen,
  onPlay,
  isPlaying = false,
  isCurrent = false,
  footer
}) => {
  const isCircle = shape === 'circle';

  return (
    <div className="group relative surface-card p-[21px] pb-6 min-w-0">
      <div
        className={`relative mb-5 overflow-hidden shadow-card ${
          isCircle ? 'rounded-full' : 'rounded'
        }`}
      >
        <CoverArt
          src={coverUrl}
          title={title}
          artist={artist}
          id={id}
          className="w-full aspect-square object-cover"
        />

        {onPlay && (
          <button
            type="button"
            onClick={onPlay}
            /* z-20 keeps this above the stretched overlay below, so the play
               action wins inside its own footprint. */
            className={`tile-fab ${
              isPlaying ? 'is-active' : ''
            } absolute bottom-2 right-2 z-20 w-14 h-14 rounded-full bg-primary hover:bg-primary-fixed text-on-primary flex items-center justify-center shadow-play hover:scale-105 transition-transform`}
            title={isPlaying ? `Pause ${title}` : `Play ${title}`}
            aria-label={isPlaying ? `Pause ${title}` : `Play ${title}`}
          >
            {isPlaying ? (
              <Pause size={22} fill="currentColor" />
            ) : (
              <Play size={22} fill="currentColor" className="ml-0.5" />
            )}
          </button>
        )}
      </div>

      <h3
        className={`text-xl font-bold tracking-title truncate ${
          isCurrent ? 'text-primary' : 'text-white'
        }`}
      >
        {title}
      </h3>

      {subtitle && (
        <p className="mt-1.5 text-base text-on-surface-variant line-clamp-2">{subtitle}</p>
      )}

      {footer && <div className="relative z-20 mt-3">{footer}</div>}

      {/* Stretched overlay: makes the whole tile one target without wrapping
          the play button in another button. */}
      <button
        type="button"
        onClick={onOpen}
        className="absolute inset-0 z-10 rounded-lg"
        aria-label={`Open ${title}`}
      />
    </div>
  );
};
