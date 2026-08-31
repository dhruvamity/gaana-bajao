import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { UserProfile, TimeOfDay, ActivityContext, DeviceType } from '../types';
import { DatabaseService } from '../services/firebase';
import { ConnectSyncService } from '../services/connectSync';
import { getAuthCookie, setAuthCookie, clearAuthCookie, isGuestId, StoredSession } from '../utils/cookieUtils';

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
  // Instant cookie recovery: if we have a valid cookie, user is immediately authenticated
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const cookie = getAuthCookie();
    if (cookie) {
      return {
        id: cookie.uid,
        name: cookie.displayName || 'Music Fan',
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

  // If we have a cookie, skip loading entirely — user is already "authenticated" 
  const [isLoading, setIsLoading] = useState<boolean>(() => !getAuthCookie());
  const [sessionDaysRemaining, setSessionDaysRemaining] = useState<number>(30);

  const [timeOfDay] = useState<TimeOfDay>(detectTimeOfDay());
  const [activityContext, setActivityContext] = useState<ActivityContext>('focus');
  const [deviceType] = useState<DeviceType>(ConnectSyncService.getDeviceType());
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState<boolean>(false);

  // Ref to track whether an explicit login call is in progress 
  // (prevents onAuthStateChanged from racing with our login methods)
  const loginInProgressRef = useRef(false);

  /* The auth listener is installed once and must not be torn down whenever the
     profile changes, so it reads the current user through a ref rather than
     closing over the state value. */
  const currentUserRef = useRef<UserProfile | null>(currentUser);
  currentUserRef.current = currentUser;

  // Sync cookie helper with 30-day max-age.
  // The email is deliberately not stored: the cookie is readable by any script
  // on the origin and nothing in the UI needs the address to repaint a shell.
  const syncSessionCookie = useCallback((user: UserProfile) => {
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const session: StoredSession = {
      uid: user.id,
      displayName: user.name,
      photoURL: user.avatar,
      kind: isGuestId(user.id) ? 'guest' : 'firebase',
      expiresAt
    };
    setAuthCookie(session, 30);
    setSessionDaysRemaining(30);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initSession = async () => {
      try {
        // 1. Check for redirect result first (if user was redirected back from Google sign-in)
        const redirectProfile = await DatabaseService.handleRedirectResult();
        if (redirectProfile && isMounted) {
          setCurrentUser(redirectProfile);
          syncSessionCookie(redirectProfile);
          setIsLoading(false);
          return;
        }

        // 2. Enhance cookie-restored profile with full database data
        const storedCookie = getAuthCookie();

        /* A session claiming a Firebase identity is only as good as Firebase's
           confirmation of it. If Auth is not configured, that confirmation can
           never arrive — onAuthChanged would never fire — so the session is
           refused here instead of being trusted by default. */
        if (storedCookie && storedCookie.kind === 'firebase' && !DatabaseService.isAuthAvailable()) {
          clearAuthCookie();
          if (isMounted) {
            setCurrentUser(null);
            setIsLoading(false);
          }
          return;
        }

        if (storedCookie) {
          const daysLeft = Math.ceil((storedCookie.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
          if (isMounted) setSessionDaysRemaining(Math.max(1, daysLeft));

          // Try to get full profile from database (local first, then Firestore)
          try {
            const fullProfile = await DatabaseService.getUserById(storedCookie.uid);
            if (fullProfile && isMounted) {
              setCurrentUser(fullProfile);
            }
          } catch {
            // Firestore read failed — cookie profile is good enough
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
    // IMPORTANT: This is guarded by loginInProgressRef to prevent race conditions
    // when our explicit login methods (loginWithGoogle, loginWithGuest) are in progress
    const unsubscribe = DatabaseService.onAuthChanged(async (fbUser) => {
      // Skip if an explicit login call is handling this
      if (loginInProgressRef.current || DatabaseService.isLoginInProgress()) {
        return;
      }

      if (!fbUser) {
        /* THIS is what makes the restore cookie safe.
           Firebase reporting "nobody is signed in" is authoritative for any
           session that claims a Firebase identity. Previously this branch did
           not exist, so a cookie naming any uid was never contradicted and the
           app would render — and attempt writes — as that user indefinitely.
           Guest sessions are exempt because they never had a Firebase identity
           to lose; they are local profiles that grant no server-side access. */
        if (isMounted && currentUserRef.current && !isGuestId(currentUserRef.current.id)) {
          clearAuthCookie();
          setCurrentUser(null);
          setIsLoading(false);
        }
        return;
      }

      if (isMounted) {
        // Only update if we don't already have this user set (prevents unnecessary re-renders)
        try {
          const existing = await DatabaseService.getUserById(fbUser.uid);
          const resolved: UserProfile = {
            id: fbUser.uid,
            name: fbUser.displayName || existing?.name || 'Music Fan',
            email: fbUser.email || existing?.email || undefined,
            avatar: fbUser.photoURL || existing?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${fbUser.uid}`,
            isOnboarded: existing ? existing.isOnboarded : false,
            selectedGenres: existing?.selectedGenres || [],
            selectedVibes: existing?.selectedVibes || [],
            likedTrackIds: existing?.likedTrackIds || [],
            savedPlaylistIds: existing?.savedPlaylistIds || [],
            recentTrackIds: existing?.recentTrackIds || []
          };
          
          if (isMounted) {
            setCurrentUser(resolved);
            syncSessionCookie(resolved);
            setIsLoading(false);
          }
        } catch (e) {
          console.warn('onAuthStateChanged profile resolution error:', e);
          // Don't clear user — keep whatever we have
        }
      }
    });

    // Safety timeout to prevent stuck loading screen
    const timer = setTimeout(() => {
      if (isMounted) setIsLoading(false);
    }, 2500);

    return () => {
      isMounted = false;
      unsubscribe();
      clearTimeout(timer);
    };
  }, [syncSessionCookie]);

  const loginWithGoogle = async (): Promise<UserProfile> => {
    loginInProgressRef.current = true;
    setIsLoading(true);
    try {
      const userProfile = await DatabaseService.loginWithGoogle();
      setCurrentUser(userProfile);
      syncSessionCookie(userProfile);
      
      if (!userProfile.isOnboarded) {
        setIsOnboardingOpen(true);
      }
      return userProfile;
    } catch (err: any) {
      // If redirect is in progress, don't clear loading — page will redirect
      if (err.message === 'REDIRECT_IN_PROGRESS') {
        // Keep loading spinner — the page will navigate away
        throw err;
      }
      throw err;
    } finally {
      loginInProgressRef.current = false;
      setIsLoading(false);
    }
  };

  const loginWithGuest = async (guestName = 'Guest Listener'): Promise<UserProfile> => {
    loginInProgressRef.current = true;
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
      loginInProgressRef.current = false;
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
