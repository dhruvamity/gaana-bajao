import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, TimeOfDay, ActivityContext, DeviceType } from '../types';
import { DatabaseService } from '../services/firebase';
import { ConnectSyncService } from '../services/connectSync';
import { getAuthCookie, setAuthCookie, clearAuthCookie, StoredSession } from '../utils/cookieUtils';

interface AuthContextType {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithGoogle: () => Promise<UserProfile>;
  loginWithGuest: (name?: string) => Promise<UserProfile>;
  loginWithDemo: (name?: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  updateUserProfile: (user: UserProfile) => Promise<void>;
  updateUserTaste: (genres: string[], vibes: string[]) => Promise<void>;
  toggleLikeTrack: (trackId: string) => Promise<void>;
  timeOfDay: TimeOfDay;
  activityContext: ActivityContext;
  setActivityContext: (activity: ActivityContext) => void;
  deviceType: DeviceType;
  isOnboardingOpen: boolean;
  setIsOnboardingOpen: (open: boolean) => void;
  isUserModalOpen: boolean;
  setIsUserModalOpen: (open: boolean) => void;
  sessionDaysRemaining: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function detectTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    // 1. Instant recovery from cookie if available
    const cookie = getAuthCookie();
    if (cookie) {
      return {
        id: cookie.uid,
        name: cookie.displayName || 'Music Fan',
        email: cookie.email || undefined,
        avatar: cookie.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${cookie.uid}`,
        isOnboarded: true,
        selectedGenres: [],
        selectedVibes: [],
        likedTrackIds: [],
        savedPlaylistIds: [],
        recentTrackIds: []
      };
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => !getAuthCookie());
  const [sessionDaysRemaining, setSessionDaysRemaining] = useState<number>(30);

  const [timeOfDay] = useState<TimeOfDay>(detectTimeOfDay());
  const [activityContext, setActivityContext] = useState<ActivityContext>('focus');
  const [deviceType] = useState<DeviceType>(ConnectSyncService.getDeviceType());
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState<boolean>(false);

  // Sync cookie helper with 30-day max-age
  const syncSessionCookie = (user: UserProfile) => {
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const session: StoredSession = {
      uid: user.id,
      email: user.email || null,
      displayName: user.name,
      photoURL: user.avatar,
      expiresAt
    };
    setAuthCookie(session, 30);
    setSessionDaysRemaining(30);
  };

  useEffect(() => {
    let isMounted = true;

    const initSession = async () => {
      try {
        const storedCookie = getAuthCookie();
        if (storedCookie) {
          const daysLeft = Math.ceil((storedCookie.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
          if (isMounted) setSessionDaysRemaining(Math.max(1, daysLeft));

          // Enhance profile with full database document
          const fullProfile = await DatabaseService.getUserById(storedCookie.uid);
          if (fullProfile && isMounted) {
            setCurrentUser(fullProfile);
          }
        }
      } catch (e) {
        console.warn('Session init error:', e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initSession();

    // Firebase Auth State Listener
    const unsubscribe = DatabaseService.onAuthChanged(async (fbUser) => {
      if (fbUser && isMounted) {
        const existing = await DatabaseService.getUserById(fbUser.uid);
        const resolved: UserProfile = {
          id: fbUser.uid,
          name: fbUser.displayName || existing?.name || 'Music Fan',
          email: fbUser.email || existing?.email || undefined,
          avatar: fbUser.photoURL || existing?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${fbUser.uid}`,
          isOnboarded: existing ? existing.isOnboarded : false,
          selectedGenres: existing ? existing.selectedGenres : [],
          selectedVibes: existing ? existing.selectedVibes : [],
          likedTrackIds: existing ? existing.likedTrackIds : [],
          savedPlaylistIds: existing ? existing.savedPlaylistIds : [],
          recentTrackIds: existing ? existing.recentTrackIds : []
        };
        
        setCurrentUser(resolved);
        syncSessionCookie(resolved);
        setIsLoading(false);
      }
    });

    // Safety timeout to prevent stuck loading
    const timer = setTimeout(() => {
      if (isMounted) setIsLoading(false);
    }, 1200);

    return () => {
      isMounted = false;
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const loginWithGoogle = async (): Promise<UserProfile> => {
    setIsLoading(true);
    try {
      const userProfile = await DatabaseService.loginWithGoogle();
      setCurrentUser(userProfile);
      syncSessionCookie(userProfile);
      
      if (!userProfile.isOnboarded) {
        setIsOnboardingOpen(true);
      }
      return userProfile;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGuest = async (guestName = 'Guest Listener'): Promise<UserProfile> => {
    setIsLoading(true);
    try {
      const userProfile = await DatabaseService.loginWithDemo(guestName);
      setCurrentUser(userProfile);
      syncSessionCookie(userProfile);
      
      if (!userProfile.isOnboarded) {
        setIsOnboardingOpen(true);
      }
      return userProfile;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await DatabaseService.logout();
      clearAuthCookie();
      setCurrentUser(null);
      localStorage.removeItem('gaana_active_user');
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserProfile = async (user: UserProfile) => {
    await DatabaseService.updateUser(user);
    setCurrentUser(user);
    syncSessionCookie(user);
  };

  const updateUserTaste = async (genres: string[], vibes: string[]) => {
    if (!currentUser) return;
    const updated: UserProfile = {
      ...currentUser,
      selectedGenres: genres,
      selectedVibes: vibes,
      isOnboarded: true,
      tasteVector: {
        energy: vibes.includes('High Energy') ? 0.85 : 0.6,
        valence: vibes.includes('Chill & Relax') ? 0.7 : 0.5,
        danceability: genres.includes('Electronic') ? 0.75 : 0.5,
        genreAffinities: genres.reduce((acc, g) => ({ ...acc, [g]: 0.9 }), {})
      }
    };
    await updateUserProfile(updated);
    setIsOnboardingOpen(false);
  };

  const toggleLikeTrack = async (trackId: string) => {
    if (!currentUser) return;
    const exists = (currentUser.likedTrackIds || []).includes(trackId);
    const updatedLiked = exists
      ? (currentUser.likedTrackIds || []).filter(id => id !== trackId)
      : [...(currentUser.likedTrackIds || []), trackId];

    const updated: UserProfile = {
      ...currentUser,
      likedTrackIds: updatedLiked
    };

    await updateUserProfile(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isLoading,
        loginWithGoogle,
        loginWithGuest,
        loginWithDemo: loginWithGuest,
        logout,
        updateUserProfile,
        updateUserTaste,
        toggleLikeTrack,
        timeOfDay,
        activityContext,
        setActivityContext,
        deviceType,
        isOnboardingOpen,
        setIsOnboardingOpen,
        isUserModalOpen,
        setIsUserModalOpen,
        sessionDaysRemaining
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
