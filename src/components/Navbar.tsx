import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  Settings,
  Sparkles,
  ChevronDown,
  LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CoverArt } from './CoverArt';

interface NavbarProps {
  currentView: string;
  onOpenUpload: () => void;
  onOpenSettings: () => void;
  /** Shared with SearchExploreView so typing here actually searches. */
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  /** True once the content column has scrolled, which opaques the bar. */
  isScrolled?: boolean;
  canGoBack?: boolean;
  onBack?: () => void;
}

/**
 * The top bar, which in this design lives *inside* the content column rather
 * than spanning the app.
 *
 * It is transparent by default so the page's hero wash shows through, and
 * turns opaque once the column scrolls. Primary navigation is not here — it
 * moved to the left column, matching the comp.
 */
export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onOpenUpload,
  onOpenSettings,
  searchQuery,
  onSearchQueryChange,
  isScrolled = false,
  canGoBack = false,
  onBack
}) => {
  const { currentUser, setIsOnboardingOpen, setIsUserModalOpen, logout } = useAuth();
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const circleButton =
    'w-8 h-8 rounded-full bg-black/70 text-white flex items-center justify-center ' +
    'transition enabled:hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <header
      className={`sticky top-0 z-40 h-header flex-shrink-0 flex items-center gap-4 px-4 sm:px-6 transition-colors duration-200 ${
        isScrolled ? 'bg-surface-container-lowest/95 backdrop-blur' : 'bg-transparent'
      }`}
    >
      {/* Back / forward. Only "back" has real history to act on — the app keeps
          a single view stack, so forward is present for shape and stays
          disabled rather than pretending to work. */}
      <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onBack}
          disabled={!canGoBack}
          className={circleButton}
          title="Go back"
          aria-label="Go back"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          disabled
          className={circleButton}
          title="Go forward"
          aria-label="Go forward"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Search field, present only on the search view — as in the comp, where
          every other screen leaves this space to the hero. */}
      {currentView === 'search' ? (
        <form
          role="search"
          onSubmit={(e) => e.preventDefault()}
          className="relative flex items-center flex-1 max-w-[364px]"
        >
          <Search
            size={20}
            className="absolute left-3.5 text-black/60 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            autoFocus
            placeholder="Artists, songs, or albums"
            aria-label="Search for songs, artists or albums"
            className="w-full h-11 pl-11 pr-4 rounded-full bg-white text-black text-sm placeholder-black/60 focus:outline-none"
          />
        </form>
      ) : (
        <div className="flex-1" />
      )}

      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Upload has no counterpart in the comp, but it is how tracks enter
            this app at all, so it keeps a permanent slot. */}
        <button
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white text-black hover:scale-105 font-bold text-sm transition-transform"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span className="hidden md:inline">Upload</span>
        </button>

        {currentUser && (
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              className="flex items-center gap-2.5 p-[3px] pr-3 rounded-full bg-black/80 hover:bg-surface-container-high transition-colors"
              title="Account"
              aria-label="Account menu"
              aria-expanded={isProfileDropdownOpen}
              aria-haspopup="menu"
            >
              <CoverArt
                src={currentUser.avatar}
                title={currentUser.name}
                id={currentUser.id}
                loading="eager"
                className="w-[34px] h-[34px] rounded-full object-cover flex-shrink-0"
              />
              <span className="text-sm font-bold text-white hidden md:inline max-w-[140px] truncate">
                {currentUser.name}
              </span>
              <ChevronDown size={16} className="text-white" />
            </button>

            {isProfileDropdownOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-56 bg-surface-container-high rounded-lg shadow-card p-1 z-50 animate-in fade-in slide-in-from-top-2"
              >
                <div className="px-3 py-2 border-b border-white/10 mb-1">
                  <div className="text-sm font-bold text-white truncate">{currentUser.name}</div>
                  {currentUser.email && (
                    <div className="text-2xs text-on-surface-variant truncate">{currentUser.email}</div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setIsUserModalOpen(true);
                    setIsProfileDropdownOpen(false);
                  }}
                  role="menuitem"
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded text-sm text-white hover:bg-white/10 transition-colors text-left"
                >
                  <Settings size={16} className="text-on-surface-variant" />
                  <span>Account &amp; Profile</span>
                </button>

                <button
                  onClick={() => {
                    setIsOnboardingOpen(true);
                    setIsProfileDropdownOpen(false);
                  }}
                  role="menuitem"
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded text-sm text-white hover:bg-white/10 transition-colors text-left"
                >
                  <Sparkles size={16} className="text-on-surface-variant" />
                  <span>Music preferences</span>
                </button>

                {/* Settings lost its own header slot in this layout, so it
                    lands in the menu the comp's chevron already implies. */}
                <button
                  onClick={() => {
                    onOpenSettings();
                    setIsProfileDropdownOpen(false);
                  }}
                  role="menuitem"
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded text-sm text-white hover:bg-white/10 transition-colors text-left"
                >
                  <Settings size={16} className="text-on-surface-variant" />
                  <span>Settings</span>
                </button>

                <button
                  onClick={() => {
                    setIsProfileDropdownOpen(false);
                    void logout();
                  }}
                  role="menuitem"
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded text-sm text-white hover:bg-white/10 transition-colors text-left"
                >
                  <LogOut size={16} className="text-on-surface-variant" />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
