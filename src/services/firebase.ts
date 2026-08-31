import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  Firestore,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { 
  getAuth, 
  Auth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser 
} from 'firebase/auth';
import { Track, Playlist, UserProfile, PublicProfile, TelemetryEvent, DeviceSession, Artist } from '../types';
import { slugifyArtistId } from '../utils/artistId';

// Default / fallback local storage keys
const STORAGE_KEYS = {
  TRACKS: 'gaana_tracks',
  PLAYLISTS: 'gaana_playlists',
  USERS: 'gaana_users',
  PUBLIC_PROFILES: 'gaana_public_profiles',
  EVENTS: 'gaana_telemetry',
  SESSIONS: 'gaana_device_sessions',
  FIREBASE_CONFIG: 'gaana_firebase_config'
};


let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

// Flag to prevent onAuthStateChanged from racing with explicit login calls
let _loginInProgress = false;

// Initialize Firebase if credentials exist
export function initFirebase(config?: Record<string, string>) {
  try {
    const envConfig = {
      apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY,
      authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID,
      storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID
    };

    const savedConfig = config 
      || (envConfig.apiKey && envConfig.projectId ? envConfig : null)
      || JSON.parse(localStorage.getItem(STORAGE_KEYS.FIREBASE_CONFIG) || 'null');

    if (savedConfig && savedConfig.apiKey && savedConfig.projectId) {
      if (!getApps().length) {
        app = initializeApp(savedConfig);
      } else {
        app = getApps()[0];
      }
      db = getFirestore(app);
      auth = getAuth(app);
      console.log('🔥 Firebase initialized successfully with project:', savedConfig.projectId);
    }
  } catch (err) {
    console.warn('Firebase initialization skipped/failed', err);
  }
}

// Auto init on import if credentials exist
initFirebase();


/**
 * Firestore rejects `undefined` outright — one undefined property fails the
 * entire `setDoc`, not just that field. Optional fields on our own types
 * (`collaborators`, `collaboratorIds`, `album`, `currentTrackId`, …) are
 * routinely absent, so every write goes through this first.
 *
 * This is not cosmetic: a playlist created without collaborators was rejected
 * whole and survived only in localStorage, which looked like it had saved
 * until the next device asked for it.
 *
 * Undefined is dropped rather than coerced to null so the field stays absent,
 * which is what `hasOnly()` shape checks in the security rules expect.
 */
function stripUndefined<T extends Record<string, any>>(value: T): T {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined) continue;
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && v.constructor === Object
      ? stripUndefined(v)
      : v;
  }
  return out as T;
}

export type WriteErrorListener = (message: string, error: unknown) => void;
const _writeErrorListeners = new Set<WriteErrorListener>();

/**
 * Register a listener for Firestore write failures so the UI can notify the user.
 */
export function onFirestoreWriteError(listener: WriteErrorListener): () => void {
  _writeErrorListeners.add(listener);
  return () => { _writeErrorListeners.delete(listener); };
}

function notifyWriteError(operation: string, error: unknown) {
  console.warn(`Firestore write failed [${operation}]:`, error);
  const msg = (error as any)?.message || 'Cloud write failed';
  _writeErrorListeners.forEach(fn => {
    try {
      fn(`Sync failed (${operation}): ${msg}`, error);
    } catch {
      // safe
    }
  });
}

/**
 * Execute a Firestore write with automatic retry and user notification on final failure.
 */
async function withWriteRetry<T>(operation: string, fn: () => Promise<T>, maxRetries = 2): Promise<T | null> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt > maxRetries) {
        notifyWriteError(operation, err);
        return null;
      }
      await new Promise(res => setTimeout(res, 400 * Math.pow(2, attempt - 1)));
    }
  }
}

/**
 * Module-level shared cache for getTracks().
 *
 * Every component used to call getTracks() independently, causing 9 full
 * collection reads (891 document reads) on a single cold page load. This
 * cache deduplicates them: concurrent calls share the same in-flight promise,
 * and the result is reused until a write invalidates it.
 */
let _tracksCache: Track[] | null = null;
let _tracksCachePromise: Promise<Track[]> | null = null;

/** Drop the cached result so the next getTracks() re-fetches. */
export function invalidateTracksCache(): void {
  _tracksCache = null;
  _tracksCachePromise = null;
}

export class DatabaseService {
  /**
   * Fetch all real tracks (purges legacy mock/dummy data automatically).
   *
   * Uses a module-level cache: the first caller triggers a fetch, and all
   * concurrent and subsequent callers share the same result until it is
   * invalidated by a write (saveTrack, deleteTrack).
   */
  public static async getTracks(): Promise<Track[]> {
    if (_tracksCache) return _tracksCache;
    if (_tracksCachePromise) return _tracksCachePromise;

    _tracksCachePromise = this._fetchTracks();
    try {
      _tracksCache = await _tracksCachePromise;
      return _tracksCache;
    } finally {
      _tracksCachePromise = null;
    }
  }

  private static async _fetchTracks(): Promise<Track[]> {
    let local: Track[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.TRACKS) || '[]');

    if (!db) return local;

    try {
      const snap = await getDocs(collection(db, 'tracks'));
      if (!snap.empty) {
        const remote: Track[] = [];
        snap.docs.forEach(d => {
          const track = { id: d.id, ...d.data() } as Track;
          remote.push(track);
        });

        localStorage.setItem(STORAGE_KEYS.TRACKS, JSON.stringify(remote));
        return remote;
      }
      return local;
    } catch (e) {
      console.warn('Firestore fetch tracks using local cache', e);
      return local;
    }
  }

  /**
   * Save a new track or update existing
   */
  public static async saveTrack(track: Track): Promise<void> {
    // Invalidate the shared cache so the next read sees the change.
    invalidateTracksCache();

    // 1. Instant local persistence
    const local = JSON.parse(localStorage.getItem(STORAGE_KEYS.TRACKS) || '[]');
    const updated = [track, ...local.filter((t: Track) => t.id !== track.id)];
    localStorage.setItem(STORAGE_KEYS.TRACKS, JSON.stringify(updated));

    // 2. Background Firestore write with retry & feedback
    if (db) {
      await withWriteRetry('Saving track', () => setDoc(doc(db!, 'tracks', track.id), stripUndefined(track)));
    }
  }

  /**
   * Delete a track
   */
  public static async deleteTrack(trackId: string): Promise<void> {
    // Invalidate the shared cache so the next read sees the deletion.
    invalidateTracksCache();

    const local = JSON.parse(localStorage.getItem(STORAGE_KEYS.TRACKS) || '[]');
    const updated = local.filter((t: Track) => t.id !== trackId);
    localStorage.setItem(STORAGE_KEYS.TRACKS, JSON.stringify(updated));

    if (db) {
      await withWriteRetry('Deleting track', () => deleteDoc(doc(db!, 'tracks', trackId)));
    }

    // Remove from playlists
    const playlists = await this.getPlaylists();
    for (const pl of playlists) {
      if (pl.trackIds.includes(trackId)) {
        await this.removeTrackFromPlaylist(pl.id, trackId);
      }
    }
  }

  /**
   * Dynamically fetch all artists aggregated from real tracks.
   *
   * Accepts an optional pre-fetched tracks array so callers that already have
   * the catalogue do not trigger another full-collection read.
   */
  public static async getArtists(prefetchedTracks?: Track[]): Promise<Artist[]> {
    const tracks = prefetchedTracks ?? await this.getTracks();
    const artistMap = new Map<string, {
      name: string;
      tracks: Track[];
      genres: Set<string>;
    }>();

    tracks.forEach(track => {
      const artistId = slugifyArtistId(track.artist);
      if (!artistMap.has(artistId)) {
        artistMap.set(artistId, {
          name: track.artist,
          tracks: [],
          genres: new Set()
        });
      }
      const entry = artistMap.get(artistId)!;
      entry.tracks.push(track);
      if (track.genre) entry.genres.add(track.genre);
    });

    return Array.from(artistMap.entries()).map(([id, data]) => {
      // Derive listeners from actual play counts instead of Math.random().
      const totalPlays = data.tracks.reduce((sum, t) => sum + (t.playCount || 0), 0);
      return {
        id,
        name: data.name,
        avatarUrl: data.tracks[0]?.coverUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${id}`,
        bannerUrl: data.tracks[0]?.coverUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${id}`,
        bio: `Artist with ${data.tracks.length} track${data.tracks.length !== 1 ? 's' : ''}`,
        genres: Array.from(data.genres),
        monthlyListeners: totalPlays,
        albumIds: [] as string[],
        topTrackIds: data.tracks.slice(0, 5).map(t => t.id),
        velocity: totalPlays > 0
          ? `${totalPlays} play${totalPlays !== 1 ? 's' : ''}`
          : 'New artist'
      };
    });
  }

  /**
   * Get artist by ID
   */
  public static async getArtistById(artistId: string): Promise<Artist | null> {
    const artists = await this.getArtists();
    return artists.find(a => a.id === artistId) || null;
  }

  /**
   * Fetch all real playlists (filters out dummy playlists)
   */
  public static async getPlaylists(): Promise<Playlist[]> {
    let local: Playlist[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '[]');

    if (!db) return local;

    try {
      const snap = await getDocs(collection(db, 'playlists'));
      if (!snap.empty) {
        const remote: Playlist[] = [];
        snap.docs.forEach(d => {
          const playlist = { id: d.id, ...d.data() } as Playlist;
          remote.push(playlist);
        });

        localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(remote));
        return remote;
      }
      return local;
    } catch (e) {
      console.warn('Firestore fetch playlists using local cache', e);
      return local;
    }
  }

  /**
   * Save or Update a Playlist
   */
  public static async savePlaylist(playlist: Playlist): Promise<void> {
    const local = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '[]');
    const updated = [playlist, ...local.filter((p: Playlist) => p.id !== playlist.id)];
    localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(updated));

    if (db) {
      await withWriteRetry('Saving playlist', () => setDoc(doc(db!, 'playlists', playlist.id), stripUndefined(playlist)));
    }
  }

  /**
   * Delete a Playlist
   */
  public static async deletePlaylist(playlistId: string): Promise<void> {
    const local = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '[]');
    const updated = local.filter((p: Playlist) => p.id !== playlistId);
    localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(updated));

    if (db) {
      await withWriteRetry('Deleting playlist', () => deleteDoc(doc(db!, 'playlists', playlistId)));
    }
  }

  /**
   * Add a track to an existing playlist
   */
  public static async addTrackToPlaylist(playlistId: string, trackId: string): Promise<Playlist | null> {
    const playlists = await this.getPlaylists();
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return null;

    if (playlist.trackIds.includes(trackId)) return playlist;

    const updatedPlaylist: Playlist = {
      ...playlist,
      trackIds: [...playlist.trackIds, trackId],
      updatedAt: Date.now()
    };
    await this.savePlaylist(updatedPlaylist);
    return updatedPlaylist;
  }

  /**
   * Remove a track from a playlist
   */
  public static async removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<Playlist | null> {
    const playlists = await this.getPlaylists();
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return null;

    const updatedPlaylist: Playlist = {
      ...playlist,
      trackIds: playlist.trackIds.filter(id => id !== trackId),
      updatedAt: Date.now()
    };
    await this.savePlaylist(updatedPlaylist);
    return updatedPlaylist;
  }

  /**
   * Fetch all user profiles
   */
  /**
   * The directory other users are allowed to see: display name and avatar only.
   *
   * This replaces a `getDocs(collection(db, 'users'))` that pulled every user
   * document into every signed-in browser — emails, liked-track history, taste
   * vectors and the optional profile PIN included — and cached the lot in
   * localStorage. Security rules now forbid that read outright, so the
   * collaborator picker reads this collection instead.
   */
  public static async getPublicProfiles(): Promise<PublicProfile[]> {
    const local: PublicProfile[] = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.PUBLIC_PROFILES) || '[]'
    );
    if (!db) return local;

    try {
      const snap = await getDocs(collection(db, 'publicProfiles'));
      if (!snap.empty) {
        const remote = snap.docs.map(d => {
          const data = d.data() as Partial<PublicProfile>;
          // Project explicitly rather than spreading: a document that somehow
          // carries extra fields must not leak them into the app.
          return { id: d.id, name: data.name || 'Listener', avatar: data.avatar || '' };
        });
        localStorage.setItem(STORAGE_KEYS.PUBLIC_PROFILES, JSON.stringify(remote));
        return remote;
      }
      return local;
    } catch (e) {
      console.warn('Firestore fetch public profiles failed, using local cache', e);
      return local;
    }
  }

  /** The locally cached profiles for this device. Never a whole-collection read. */
  private static readLocalUsers(): UserProfile[] {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
  }

  /**
   * Fetch user profile by ID
   */
  public static async getUserById(userId: string): Promise<UserProfile | null> {
    const local = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const localUser = local.find((u: UserProfile) => u.id === userId);

    if (db) {
      try {
        const snap = await getDoc(doc(db, 'users', userId));
        if (snap.exists()) {
          const remoteUser = { id: snap.id, ...snap.data() } as UserProfile;
          // Update local cache
          const updated = [remoteUser, ...local.filter((u: UserProfile) => u.id !== userId)];
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updated));
          return remoteUser;
        }
      } catch (e) {
        console.warn('Firestore fetch user by ID failed', e);
      }
    }

    return localUser || null;
  }

  /**
   * Check if a login is currently in progress (to prevent race conditions with onAuthStateChanged)
   */
  public static isLoginInProgress(): boolean {
    return _loginInProgress;
  }

  /**
   * Google Sign-In via Firebase Auth (popup with redirect fallback)
   */
  public static async loginWithGoogle(): Promise<UserProfile> {
    if (!auth) {
      initFirebase();
    }
    if (!auth) {
      throw new Error('Firebase Auth is not initialized. Check your .env credentials.');
    }

    _loginInProgress = true;

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      let fbUser: FirebaseUser;

      try {
        // Try popup first
        const userCredential = await signInWithPopup(auth, provider);
        fbUser = userCredential.user;
      } catch (popupErr: any) {
        // If popup is blocked, fall back to redirect
        if (popupErr.code === 'auth/popup-blocked' || popupErr.code === 'auth/cancelled-popup-request') {
          console.warn('Popup blocked, falling back to redirect sign-in...');
          await signInWithRedirect(auth, provider);
          // This will redirect the page — the result is handled on page load via handleRedirectResult
          throw new Error('REDIRECT_IN_PROGRESS');
        }
        throw popupErr;
      }

      // Construct user profile immediately from Firebase Auth user object
      const userProfile = await this.buildProfileFromFirebaseUser(fbUser);
      
      // Save to local storage & Firestore immediately
      await this.saveUserSync(userProfile);
      return userProfile;
    } catch (err: any) {
      if (err.message === 'REDIRECT_IN_PROGRESS') {
        throw err;
      }
      console.error('Firebase Auth Error details:', err);
      if (err.code === 'auth/operation-not-allowed') {
        throw new Error('Google Sign-In is not enabled yet in your Firebase project. In Firebase Console, go to Authentication > Sign-in method > Enable Google.');
      } else if (err.code === 'auth/popup-blocked') {
        throw new Error('Pop-up window was blocked by your browser. Please allow pop-ups for localhost and click "Continue with Google" again.');
      } else if (err.code === 'auth/unauthorized-domain') {
        throw new Error('This domain is not authorized in Firebase Console. Add "localhost" under Authentication > Settings > Authorized Domains.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in popup was closed before completing. Please try again.');
      }
      throw new Error(err.message || 'Firebase Google Sign-in failed.');
    } finally {
      _loginInProgress = false;
    }
  }

  /**
   * Handle redirect result (called on page load after a redirect sign-in)
   */
  public static async handleRedirectResult(): Promise<UserProfile | null> {
    if (!auth) return null;

    try {
      const result = await getRedirectResult(auth);
      if (result && result.user) {
        const userProfile = await this.buildProfileFromFirebaseUser(result.user);
        await this.saveUserSync(userProfile);
        return userProfile;
      }
    } catch (err: any) {
      console.error('Redirect result error:', err);
    }
    return null;
  }

  /**
   * Build a UserProfile from a Firebase Auth user, merging with existing data if available
   */
  private static async buildProfileFromFirebaseUser(fbUser: FirebaseUser): Promise<UserProfile> {
    // Check local storage first (fast), then Firestore (background)
    const local = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const localExisting = local.find((u: UserProfile) => u.id === fbUser.uid) || null;

    // Try Firestore but don't block on it — use local if available
    let existing = localExisting;
    if (db) {
      try {
        const snap = await getDoc(doc(db, 'users', fbUser.uid));
        if (snap.exists()) {
          existing = { id: snap.id, ...snap.data() } as UserProfile;
        }
      } catch {
        // Firestore read failed — use local cache, no big deal
      }
    }

    return {
      id: fbUser.uid,
      name: fbUser.displayName || existing?.name || 'Music Lover',
      email: fbUser.email || existing?.email || undefined,
      avatar: fbUser.photoURL || existing?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${fbUser.uid}`,
      isOnboarded: existing ? existing.isOnboarded : false,
      selectedGenres: existing?.selectedGenres || [],
      selectedVibes: existing?.selectedVibes || [],
      likedTrackIds: existing?.likedTrackIds || [],
      savedPlaylistIds: existing?.savedPlaylistIds || [],
      recentTrackIds: existing?.recentTrackIds || []
    };
  }

  /**
   * Helper to sync user profile across localStorage and Firestore
   */
  private static async saveUserSync(user: UserProfile): Promise<void> {
    // 1. Always update localStorage FIRST (synchronous, guaranteed)
    const local = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const updated = [user, ...local.filter((u: UserProfile) => u.id !== user.id)];
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updated));

    // 2. Background Firestore write (best-effort with retry)
    if (db) {
      await withWriteRetry('Saving user profile', () =>
        setDoc(doc(db!, 'users', user.id), stripUndefined(user), { merge: true })
      );

      // 3. Publish only the fields other users may see. Written separately so
      //    the private document never has to be readable to render a name.
      await withWriteRetry('Updating public profile', () =>
        setDoc(
          doc(db!, 'publicProfiles', user.id),
          { name: user.name, avatar: user.avatar || '' },
          { merge: true }
        )
      );
    }
  }

  /**
   * Sign out of Firebase Auth
   */
  public static async logout(): Promise<void> {
    if (auth) {
      await signOut(auth);
    }
  }

  /**
   * Whether Firebase Auth is configured at all.
   *
   * When it is not, `onAuthChanged` never fires, so nothing can confirm or
   * contradict a session that claims a Firebase identity. Callers use this to
   * refuse such a session rather than trusting it by default.
   */
  public static isAuthAvailable(): boolean {
    return auth !== null;
  }

  /**
   * Listen to Firebase Auth state
   */
  public static onAuthChanged(callback: (user: FirebaseUser | null) => void): () => void {
    if (auth) {
      return onAuthStateChanged(auth, callback);
    }
    return () => {};
  }

  /**
   * Create a new user profile
   */
  public static async createUser(user: UserProfile): Promise<void> {
    await this.saveUserSync(user);
  }

  /**
   * Update User Profile (likes, taste profile, onboarding, PIN)
   */
  public static async updateUser(user: UserProfile): Promise<void> {
    await this.saveUserSync(user);
  }

  /**
   * Delete a user profile
   */
  public static async deleteUser(userId: string): Promise<void> {
    const updated = this.readLocalUsers().filter(u => u.id !== userId);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updated));

    if (db) {
      // Both documents go, or the directory keeps advertising a user that no
      // longer exists.
      await withWriteRetry('Deleting user', () => deleteDoc(doc(db!, 'users', userId)));
      await withWriteRetry('Deleting public profile', () => deleteDoc(doc(db!, 'publicProfiles', userId)));
    }
  }

  /**
   * Log Telemetry Interaction Event
   */
  public static async logTelemetry(event: TelemetryEvent): Promise<void> {
    const raw = localStorage.getItem(STORAGE_KEYS.EVENTS);
    const events: TelemetryEvent[] = raw ? JSON.parse(raw) : [];
    events.unshift(event);
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events.slice(0, 500)));

    if (db) {
      await withWriteRetry('Telemetry log', () => setDoc(doc(db!, 'telemetry', event.id), stripUndefined(event)));
    }
  }

  /**
   * This user's telemetry events, most recent first.
   *
   * The `userId` filter is not an optimisation — it is what makes the query
   * legal. Firestore evaluates rules against the QUERY, not the returned rows,
   * so a query that *could* match another user's documents is refused whole
   * under `allow read: if resource.data.userId == uid()`. The unfiltered
   * version of this query also spent its 100-document budget on other users'
   * events, which `computeCompositeScore` then discarded — quietly starving
   * the home shelves of the caller's own history.
   *
   * Needs the composite index (userId ASC, timestamp DESC); see firestore.indexes.json.
   */
  public static async getTelemetryEvents(userId?: string | null): Promise<TelemetryEvent[]> {
    const readLocal = (): TelemetryEvent[] => {
      const local = localStorage.getItem(STORAGE_KEYS.EVENTS);
      const all: TelemetryEvent[] = local ? JSON.parse(local) : [];
      return userId ? all.filter(e => e.userId === userId) : all;
    };

    if (db && userId) {
      try {
        const q = query(
          collection(db, 'telemetry'),
          where('userId', '==', userId),
          orderBy('timestamp', 'desc'),
          limit(100)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          return snap.docs.map(d => ({ id: d.id, ...d.data() } as TelemetryEvent));
        }
      } catch (e) {
        console.warn('Firestore fetch telemetry failed; using local events', e);
      }
    }

    return readLocal();
  }

  /**
   * Update a Device Session (playback state & position)
   */
  public static async updateDeviceSession(session: DeviceSession): Promise<void> {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    const sessions: DeviceSession[] = raw ? JSON.parse(raw) : [];
    const updated = [session, ...sessions.filter(s => s.id !== session.id)];
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(updated));

    if (db) {
      await withWriteRetry('Device session update', () =>
        setDoc(doc(db!, 'device_sessions', session.id), stripUndefined(session), { merge: true })
      );
    }
  }

  /**
   * Realtime listener for Device Sessions
   */
  /**
   * Realtime listener for THIS user's device sessions.
   *
   * Same rule-compatibility constraint as telemetry: an unfiltered listen on
   * the whole collection is refused once `device_sessions` is gated on
   * `userId`. It was also handing every user the full list of every other
   * user's devices, current track and playback position.
   */
  public static subscribeDeviceSessions(
    userId: string | null | undefined,
    callback: (sessions: DeviceSession[]) => void
  ): () => void {
    if (db && userId) {
      try {
        const q = query(collection(db, 'device_sessions'), where('userId', '==', userId));
        return onSnapshot(
          q,
          (snap) => {
            callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as DeviceSession)));
          },
          (err) => console.warn('Firestore device sessions listener error', err)
        );
      } catch (e) {
        console.warn('Firestore device sessions listener error', e);
      }
    }
    return () => {};
  }
}
