import React, { useState, useRef, useEffect } from 'react';
import { 
  Home, 
  Search, 
  Compass, 
  Plus, 
  Settings, 
  Cast, 
  Sparkles, 
  ChevronDown,
  UserCheck,
  UserPlus,
  Bell,
  Download,
  FolderPlus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAudio } from '../context/AudioContext';
import { CoverArt } from './CoverArt';

interface NavbarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  onOpenUpload: () => void;
  onOpenSettings: () => void;
  /** Shared with SearchExploreView so typing here actually searches. */
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  onOpenUpload,
  onOpenSettings,
  searchQuery,
  onSearchQueryChange
}) => {
  const { 
    currentUser, 
    setIsOnboardingOpen,
    setIsUserModalOpen
  } = useAuth();
  
  const { setIsConnectOpen } = useAudio();
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

  return (
    <header className="z-40 w-full bg-background px-4 sm:px-6 py-2 flex items-center justify-between gap-4 flex-shrink-0">
      {/* 1. Left: Brand & Home Navigation Button */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button 
          onClick={() => setCurrentView('home')}
          className="flex items-center gap-2.5 group text-left"
        >
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary text-lg font-bold">graphic_eq</span>
          </div>
          <h1 className="font-headline font-bold text-base tracking-tight text-white hidden sm:inline">
            Gaana-Bajao
          </h1>
        </button>

        {/* Circular Home Icon button */}
        <button
          onClick={() => setCurrentView('home')}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${
            currentView === 'home'
              ? 'bg-surface-container-high text-white'
              : 'bg-surface-container text-on-surface-variant hover:text-white hover:bg-surface-container-high'
          }`}
          title="Home"
          aria-label="Home"
          aria-current={currentView === 'home' ? 'page' : undefined}
        >
          <Home size={22} fill={currentView === 'home' ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* 2. Center: Global Search Input Pill */}
      <div className="flex-1 max-w-[474px] mx-auto">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setCurrentView('search');
          }}
          className="relative flex items-center group"
        >
          <Search
            size={18}
            className="absolute left-3.5 text-on-surface-variant group-focus-within:text-white transition-colors pointer-events-none"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              onSearchQueryChange(e.target.value);
              if (currentView !== 'search') setCurrentView('search');
            }}
            onFocus={() => setCurrentView('search')}
            placeholder="What do you want to play?"
            aria-label="Search for songs, artists or moods"
            className="w-full h-12 pl-11 pr-12 rounded-full bg-surface-container hover:bg-surface-container-high focus:bg-surface-container-high border border-transparent focus:border-white/20 text-white text-sm placeholder-on-surface-variant focus:outline-none transition-colors"
          />
          <span className="absolute right-12 w-px h-6 bg-white/20" aria-hidden="true" />
          <button
            type="button"
            onClick={() => setCurrentView('search')}
            className="absolute right-3 p-1 text-on-surface-variant hover:text-white transition-colors"
            title="Browse all"
            aria-label="Browse all"
          >
            <Compass size={20} />
          </button>
        </form>
      </div>

      {/* 3. Right: Action Buttons & User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Upload Audio Track */}
        <button
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-black hover:bg-white/90 hover:scale-105 font-bold text-sm transition-all"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span className="hidden md:inline">Upload</span>
        </button>

        {/* Connect & Devices */}
        <button
          onClick={() => setIsConnectOpen(true)}
          className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-white transition-colors hover:scale-105"
          title="Connect to a device"
          aria-label="Connect to a device"
        >
          <Cast size={20} />
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-white transition-colors hover:scale-105"
          title="Settings"
          aria-label="Settings"
        >
          <Settings size={20} />
        </button>

        {/* User Account Button & Dropdown */}
        {currentUser && (
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              className="flex items-center gap-2 p-1 pr-2 rounded-full bg-black hover:bg-surface-container-high transition-colors cursor-pointer"
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
                className="w-8 h-8 rounded-full object-cover"
              />
              <span className="text-sm font-bold text-white hidden md:inline">{currentUser.name}</span>
              <ChevronDown size={16} className="text-on-surface-variant" />
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
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
