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

interface NavbarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  onOpenUpload: () => void;
  onOpenSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  onOpenUpload,
  onOpenSettings
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
    <header className="sticky top-0 z-40 w-full bg-surface-container-lowest/90 backdrop-blur-2xl px-4 sm:px-6 py-2.5 flex items-center justify-between border-b border-white/5 gap-4">
      {/* 1. Left: Brand & Home Navigation Button */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button 
          onClick={() => setCurrentView('home')}
          className="flex items-center gap-2.5 group text-left"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-primary-fixed flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-on-primary text-xl font-bold">graphic_eq</span>
          </div>
          <h1 className="font-headline font-bold text-lg tracking-tight text-white hidden sm:inline">
            Gaana-Bajao
          </h1>
        </button>

        {/* Circular Home Icon button */}
        <button
          onClick={() => setCurrentView('home')}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            currentView === 'home'
              ? 'bg-white text-black shadow-md'
              : 'bg-white/10 text-white/80 hover:text-white hover:bg-white/20 hover:scale-105'
          }`}
          title="Home"
        >
          <Home size={19} />
        </button>
      </div>

      {/* 2. Center: Global Search Input Pill */}
      <div className="flex-1 max-w-lg mx-auto">
        <div 
          onClick={() => currentView !== 'search' && setCurrentView('search')}
          className="relative flex items-center group cursor-pointer"
        >
          <Search size={18} className="absolute left-3.5 text-on-surface-variant group-hover:text-white transition-colors" />
          <input
            type="text"
            onFocus={() => setCurrentView('search')}
            placeholder="What do you want to play?"
            className="w-full pl-10 pr-10 py-2.5 rounded-full bg-surface-container border border-transparent hover:border-white/20 focus:border-white/40 text-white text-xs sm:text-sm placeholder-on-surface-variant focus:outline-none transition-all"
          />
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setCurrentView('search');
            }}
            className="absolute right-3 p-1 text-on-surface-variant hover:text-white"
            title="Browse all"
          >
            <Compass size={16} />
          </button>
        </div>
      </div>

      {/* 3. Right: Action Buttons & User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Upload Audio Track */}
        <button
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-black hover:bg-white/90 font-bold text-xs shadow-md transition-all hover:scale-102"
        >
          <Plus size={15} strokeWidth={2.5} />
          <span className="hidden md:inline">Upload Music</span>
        </button>

        {/* Connect & Devices */}
        <button
          onClick={() => setIsConnectOpen(true)}
          className="p-2.5 rounded-full hover:bg-white/10 text-on-surface-variant hover:text-white transition-all relative"
          title="Connect to a device"
        >
          <Cast size={18} />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary"></span>
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="p-2.5 rounded-full hover:bg-white/10 text-on-surface-variant hover:text-white transition-all"
          title="Settings"
        >
          <Settings size={18} />
        </button>

        {/* User Account Button & Dropdown */}
        {currentUser && (
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              className="flex items-center gap-2 p-1 pr-2 rounded-full bg-surface-container hover:bg-white/10 transition-all border border-white/5 cursor-pointer"
              title="Account"
            >
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-7 h-7 rounded-full object-cover ring-1 ring-primary/50"
              />
              <span className="text-xs font-bold text-white hidden md:inline">{currentUser.name}</span>
              <ChevronDown size={13} className="text-on-surface-variant" />
            </button>

            {isProfileDropdownOpen && (
              <div 
                className="absolute right-0 mt-2 w-60 glass-elevated rounded-2xl border border-white/15 shadow-2xl p-2.5 z-50 animate-in fade-in slide-in-from-top-2 space-y-1"
              >
                <div className="px-3 py-2 border-b border-white/10 mb-1">
                  <div className="text-xs font-bold text-white truncate">{currentUser.name}</div>
                  {currentUser.email && (
                    <div className="text-[11px] text-on-surface-variant truncate">{currentUser.email}</div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setIsUserModalOpen(true);
                    setIsProfileDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-white hover:bg-white/10 font-bold transition-all text-left"
                >
                  <Settings size={14} className="text-primary" />
                  <span>Account & Profile</span>
                </button>

                <button
                  onClick={() => {
                    setIsOnboardingOpen(true);
                    setIsProfileDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-white hover:bg-white/10 font-bold transition-all text-left"
                >
                  <Sparkles size={14} className="text-tertiary" />
                  <span>Customize Taste Vector</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
