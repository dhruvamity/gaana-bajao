import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Check, 
  Zap, 
  Flame, 
  Coffee, 
  Moon, 
  Activity, 
  Music, 
  Radio, 
  Plus, 
  X 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DatabaseService } from '../services/firebase';

export const TasteOnboarding: React.FC = () => {
  const { isOnboardingOpen, setIsOnboardingOpen, updateUserTaste, currentUser } = useAuth();

  const [availableGenres, setAvailableGenres] = useState<string[]>([
    'Electronic', 'Synthwave', 'Lo-Fi', 'Ambient', 'Indie Rock', 'Neo-Soul', 'Future Bass', 'Hip Hop'
  ]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  
  // Custom tag addition
  const [customTagInput, setCustomTagInput] = useState('');
  const [customTagType, setCustomTagType] = useState<'genre' | 'vibe'>('genre');

  const defaultVibes = [
    'Deep Focus',
    'High-Velocity Workout',
    'Midnight Drive',
    'Atmospheric Chill',
    'Coding Flow',
    'Rainy Afternoon',
    'Sunrise Energy',
    'Late Night Vibe'
  ];
  const [availableVibes, setAvailableVibes] = useState<string[]>(defaultVibes);

  useEffect(() => {
    if (currentUser) {
      setSelectedGenres(currentUser.selectedGenres || []);
      setSelectedVibes(currentUser.selectedVibes || []);

      // Pull genres from catalog
      DatabaseService.getTracks().then(tracks => {
        const catalogGenres = new Set<string>(availableGenres);
        tracks.forEach(t => {
          if (t.genre) catalogGenres.add(t.genre);
        });
        setAvailableGenres(Array.from(catalogGenres));
      });
    }
  }, [currentUser, isOnboardingOpen]);

  if (!isOnboardingOpen || !currentUser) return null;

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const toggleVibe = (vibe: string) => {
    setSelectedVibes(prev =>
      prev.includes(vibe) ? prev.filter(v => v !== vibe) : [...prev, vibe]
    );
  };

  const handleAddCustomTag = (e: React.FormEvent) => {
    e.preventDefault();
    const tag = customTagInput.trim();
    if (!tag) return;

    if (customTagType === 'genre') {
      if (!availableGenres.includes(tag)) {
        setAvailableGenres(prev => [...prev, tag]);
      }
      if (!selectedGenres.includes(tag)) {
        setSelectedGenres(prev => [...prev, tag]);
      }
    } else {
      if (!availableVibes.includes(tag)) {
        setAvailableVibes(prev => [...prev, tag]);
      }
      if (!selectedVibes.includes(tag)) {
        setSelectedVibes(prev => [...prev, tag]);
      }
    }
    setCustomTagInput('');
  };

  const handleSave = async () => {
    await updateUserTaste(selectedGenres, selectedVibes);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-none flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl glass-elevated border border-white/20 rounded-lg p-6 sm:p-10 shadow-card space-y-8 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 text-primary border border-primary/30 text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles size={13} />
            Taste Profile Vector
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Personalize Your Acoustic Matrix
          </h2>
          <p className="text-xs sm:text-sm text-on-surface-variant max-w-md mx-auto">
            Select your favorite genres and daily listening contexts to power recommendations for <span className="text-white font-bold">{currentUser.name}</span>.
          </p>
        </div>

        {/* 1. Genres Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-primary">
            <span>Favorite Genres ({selectedGenres.length} selected)</span>
            <span className="text-on-surface-variant font-normal">Choose 1 or more</span>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {availableGenres.map((genre) => {
              const isSelected = selectedGenres.includes(genre);

              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => toggleGenre(genre)}
                  className={`px-4 py-2 rounded-lg border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-black border-primary shadow-lg  scale-105'
                      : 'bg-surface-container/80 border-white/10 text-on-surface-variant hover:text-white hover:border-white/20'
                  }`}
                >
                  <span>{genre}</span>
                  {isSelected && <Check size={14} className="stroke-[3]" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Mood & Vibe Chips */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-tertiary">
            <span>Listening Contexts & Moods ({selectedVibes.length} selected)</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {availableVibes.map((vibe) => {
              const isSelected = selectedVibes.includes(vibe);
              return (
                <button
                  key={vibe}
                  type="button"
                  onClick={() => toggleVibe(vibe)}
                  className={`px-3.5 py-2 rounded text-xs font-semibold transition-all border cursor-pointer ${
                    isSelected
                      ? 'bg-white text-black border-white shadow-md'
                      : 'bg-surface-container-high/60 border-white/5 text-on-surface-variant hover:text-white'
                  }`}
                >
                  {vibe}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Add Custom Tag Form */}
        <form onSubmit={handleAddCustomTag} className="p-4 rounded-lg bg-surface-container-high/40 border border-white/5 space-y-3">
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <Plus size={14} className="text-primary" />
            <span>Add Custom Genre or Mood Tag</span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={customTagType}
              onChange={(e) => setCustomTagType(e.target.value as any)}
              className="px-3 py-2 rounded bg-surface-container border border-white/10 text-white text-xs focus:outline-none focus:border-primary"
            >
              <option value="genre">Genre</option>
              <option value="vibe">Mood / Vibe</option>
            </select>

            <input
              type="text"
              value={customTagInput}
              onChange={(e) => setCustomTagInput(e.target.value)}
              placeholder="e.g. Progressive Metal, Coding Chill..."
              className="flex-1 px-3.5 py-2 rounded bg-surface-container border border-white/10 text-white text-xs focus:outline-none focus:border-primary"
            />

            <button
              type="submit"
              disabled={!customTagInput.trim()}
              className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-bold disabled:opacity-40 transition-colors"
            >
              Add
            </button>
          </div>
        </form>

        {/* CTA Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <button
            onClick={() => setIsOnboardingOpen(false)}
            className="text-xs font-bold text-on-surface-variant hover:text-white transition-colors"
          >
            Skip for now
          </button>

          <button
            onClick={handleSave}
            disabled={selectedGenres.length === 0}
            className="px-8 py-3 rounded-full bg-primary hover:bg-primary/90 text-black font-extrabold text-xs shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <span>Save Taste Profile</span>
            <Check size={16} />
          </button>
        </div>

      </div>
    </div>
  );
};
