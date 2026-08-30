import React from 'react';

interface SectionHeaderProps {
  title: string;
  /** Renders the comp's uppercase "SEE ALL" affordance when provided. */
  onSeeAll?: () => void;
  seeAllLabel?: string;
  /** A plain right-hand caption, for sections with nothing more to show. */
  meta?: string;
}

/**
 * Figma: a 30px bold heading tracked at -0.9px, with an uppercase label tracked
 * at +1.28px flush right.
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  onSeeAll,
  seeAllLabel = 'See all',
  meta
}) => (
  <div className="flex items-end justify-between gap-4 mb-6">
    <h2 className="text-3xl font-bold text-white tracking-display truncate">{title}</h2>

    {onSeeAll ? (
      <button
        type="button"
        onClick={onSeeAll}
        className="flex-shrink-0 text-sm font-bold uppercase tracking-label text-on-surface-variant hover:text-white hover:underline transition-colors"
      >
        {seeAllLabel}
      </button>
    ) : meta ? (
      <span className="flex-shrink-0 text-sm font-bold uppercase tracking-label text-on-surface-variant">
        {meta}
      </span>
    ) : null}
  </div>
);
