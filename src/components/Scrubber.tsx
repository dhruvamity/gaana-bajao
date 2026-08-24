import React, { useCallback, useEffect, useRef, useState } from 'react';

interface ScrubberProps {
  /** Current position, in the same unit as `max`. */
  value: number;
  max: number;
  onSeek: (value: number) => void;
  /** Accessible name, e.g. "Seek" or "Volume". */
  label: string;
  /** Formats the value for screen readers ("1:23 of 4:05"). */
  formatValue?: (value: number) => string;
  className?: string;
  /** Track thickness at rest; it grows slightly on hover. */
  size?: 'sm' | 'md';
}

/**
 * A seek/progress bar that behaves like a real slider.
 *
 * The previous scrubbers were plain divs with a click handler: no dragging, no
 * touch support, no keyboard access and nothing announced to assistive tech.
 * This supports pointer drag, arrow keys, Home/End and Page Up/Down, and
 * exposes proper slider semantics.
 */
export const Scrubber: React.FC<ScrubberProps> = ({
  value,
  max,
  onSeek,
  label,
  formatValue,
  className = '',
  size = 'sm'
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragValue, setDragValue] = useState<number | null>(null);

  // While dragging, show the dragged position rather than playback position,
  // otherwise the handle fights the incoming timeupdate events.
  const displayed = dragValue ?? value;
  const percent = max > 0 ? Math.min(100, Math.max(0, (displayed / max) * 100)) : 0;

  const valueFromPointer = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return 0;
      const ratio = (clientX - rect.left) / rect.width;
      return Math.min(max, Math.max(0, ratio * max));
    },
    [max]
  );

  // Pointer capture keeps the drag alive when the cursor leaves the track.
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (max <= 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragValue(valueFromPointer(e.clientX));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragValue === null) return;
    setDragValue(valueFromPointer(e.clientX));
  };

  const commit = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragValue === null) return;
    const next = valueFromPointer(e.clientX);
    setDragValue(null);
    onSeek(next);
  };

  // A pointer lost mid-gesture (window blur, cancelled touch) must not leave
  // the handle stuck away from the real playback position.
  useEffect(() => {
    const cancel = () => setDragValue(null);
    window.addEventListener('pointercancel', cancel);
    return () => window.removeEventListener('pointercancel', cancel);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (max <= 0) return;
    const step = max > 60 ? 5 : max / 20;
    const bigStep = max > 60 ? 15 : max / 5;
    let next: number | null = null;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = Math.min(max, value + step);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = Math.max(0, value - step);
        break;
      case 'PageUp':
        next = Math.min(max, value + bigStep);
        break;
      case 'PageDown':
        next = Math.max(0, value - bigStep);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = max;
        break;
      default:
        return;
    }
    e.preventDefault();
    onSeek(next);
  };

  const height = size === 'md' ? 'h-1.5' : 'h-1';

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(displayed)}
      aria-valuetext={formatValue ? formatValue(displayed) : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={commit}
      onKeyDown={handleKeyDown}
      className={`scrub-track group relative ${height} rounded-full cursor-pointer touch-none ${className}`}
    >
      <div
        className="scrub-fill absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${percent}%` }}
      />
      <div
        className={`scrub-thumb absolute top-1/2 w-3 h-3 -mt-1.5 -ml-1.5 rounded-full bg-white pointer-events-none ${
          dragValue !== null ? 'opacity-100' : ''
        }`}
        style={{ left: `${percent}%` }}
      />
    </div>
  );
};
