import React from 'react';
import { Home, Search, Library } from 'lucide-react';

interface MobileTabBarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

const TABS: Array<{ view: string; label: string; icon: typeof Home }> = [
  { view: 'home', label: 'Home', icon: Home },
  { view: 'search', label: 'Search', icon: Search },
  { view: 'playlists', label: 'Your Library', icon: Library }
];

/**
 * The mobile comp's three-tab bar.
 *
 * Below the `md` breakpoint the navigation column is hidden, and until now
 * nothing replaced it — there was no way to change view on a phone at all.
 * Figma: 22px icons over ~12px labels, on black, clearing the home indicator.
 */
export const MobileTabBar: React.FC<MobileTabBarProps> = ({ currentView, onNavigate }) => (
  <nav
    className="md:hidden flex-shrink-0 bg-background border-t border-white/5 pb-safe"
    aria-label="Primary"
  >
    <ul className="flex items-stretch h-tabbar">
      {TABS.map(({ view, label, icon: Icon }) => {
        const isActive = currentView === view;
        return (
          <li key={view} className="flex-1">
            <button
              type="button"
              onClick={() => onNavigate(view)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full h-full flex flex-col items-center justify-center gap-1.5 transition-colors ${
                isActive ? 'text-white' : 'text-on-surface-variant'
              }`}
            >
              <Icon size={22} fill={isActive && view === 'home' ? 'currentColor' : 'none'} />
              <span className="text-2xs font-medium leading-none">{label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  </nav>
);
