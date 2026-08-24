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
  orderBy,
  limit
} from 'firebase/firestore';
import { 
  getAuth, 
  Auth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser 
} from 'firebase/auth';
import { Track, Playlist, UserProfile, TelemetryEvent, DeviceSession, Artist } from '../types';

// Default / fallback local storage keys
const STORAGE_KEYS = {
  TRACKS: 'gaana_tracks',
  PLAYLISTS: 'gaana_playlists',
  USERS: 'gaana_users',
  EVENTS: 'gaana_telemetry',
  SESSIONS: 'gaana_device_sessions',
  FIREBASE_CONFIG: 'gaana_firebase_config'
};

const DUMMY_KEYWORDS = [
  'kavinsky',
  'aurora borealis',
  'neon horizon',
  'glacier',
  'thesis 5',
  'bart mix',
  'daily flow',
  'velocity radar',
  'cyber focus'
];

export function isDummyTrack(t: Partial<Track>): boolean {
  if (!t) return true;
  const artistLower = (t.artist || '').toLowerCase();
  const titleLower = (t.title || '').toLowerCase();
  const url = (t.audioUrl || '').toLowerCase();
  if (DUMMY_KEYWORDS.some(k => artistLower.includes(k) || titleLower.includes(k))) return true;
  if (!url || url.includes('placeholder') || url.includes('example.com')) return true;
  return false;
}

export function isDummyPlaylist(p: Partial<Playlist>): boolean {
  if (!p) return true;
  if (p.isAlgorithmic) return true;
  const titleLower = (p.title || '').toLowerCase();
  const ownerLower = (p.ownerName || '').toLowerCase();
  if (DUMMY_KEYWORDS.some(k => titleLower.includes(k) || ownerLower.includes(k))) return true;
  return false;
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

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

export class DatabaseService {
  /**
   * Fetch all real tracks (purges legacy mock/dummy data automatically)
   */
  public static async getTracks(): Promise<Track[]> {
    let local: Track[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.TRACKS) || '[]');
    local = local.filter(t => !isDummyTrack(t));
    localStorage.setItem(STORAGE_KEYS.TRACKS, JSON.stringify(local));

    if (!db) return local;

    try {
      const snap = await getDocs(collection(db, 'tracks'));
      if (!snap.empty) {
        const remote: Track[] = [];
        const toPurge: string[] = [];

        snap.docs.forEach(d => {
          const track = { id: d.id, ...d.data() } as Track;
          if (isDummyTrack(track)) {
            toPurge.push(d.id);
          } else {
            remote.push(track);
          }
        });

        // Asynchronously purge dummy tracks from Firestore
        toPurge.forEach(id => {
          deleteDoc(doc(db!, 'tracks', id)).catch(() => {});
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
    if (isDummyTrack(track)) return;

    // 1. Instant local persistence
    const local = JSON.parse(localStorage.getItem(STORAGE_KEYS.TRACKS) || '[]');
    const updated = [track, ...local.filter((t: Track) => t.id !== track.id)];
    localStorage.setItem(STORAGE_KEYS.TRACKS, JSON.stringify(updated));

    // 2. Background Firestore write
    if (db) {
      try {
        await setDoc(doc(db, 'tracks', track.id), track);
      } catch (e) {
        console.warn('Firestore track sync pending/failed', e);
      }
    }
  }

  /**
   * Delete a track
   */
  public static async deleteTrack(trackId: string): Promise<void> {
    const local = JSON.parse(localStorage.getItem(STORAGE_KEYS.TRACKS) || '[]');
    const updated = local.filter((t: Track) => t.id !== trackId);
    localStorage.setItem(STORAGE_KEYS.TRACKS, JSON.stringify(updated));

    if (db) {
      try {
        await deleteDoc(doc(db, 'tracks', trackId));
      } catch (e) {
        console.warn('Firestore delete track failed', e);
      }
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
   * Dynamically fetch all artists aggregated from real tracks
   */
  public static async getArtists(): Promise<Artist[]> {
    const tracks = await this.getTracks();
    const artistMap = new Map<string, {
      name: string;
      tracks: Track[];
      genres: Set<string>;
      coverUrl: string;
    }>();

    tracks.forEach(track => {
      if (isDummyTrack(track)) return;
      const artistKey = track.artistId || track.artist.toLowerCase().replace(/\s+/g, '-');
      if (!artistMap.has(artistKey)) {
        artistMap.set(artistKey, {
          name: track.artist,
          tracks: [],
          genres: new Set(),
          coverUrl: track.coverUrl
        });
      }
      const entry = artistMap.get(artistKey)!;
      entry.tracks.push(track);
      if (track.genre) entry.genres.add(track.genre);
    });

    const dynamicArtists: Artist[] = [];
    artistMap.forEach((val, key) => {
      const totalPlays = val.tracks.reduce((acc, t) => acc + (t.playCount || 0), 0);
      const totalSaves = val.tracks.reduce((acc, t) => acc + (t.saveCount || 0), 0);
      dynamicArtists.push({
        id: key,
        name: val.name,
        avatarUrl: val.coverUrl,
        bannerUrl: val.coverUrl,
        bio: `${val.name} is featured on Gaana-Bajao with ${val.tracks.length} releases in the catalog.`,
        monthlyListeners: Math.max(1200, totalPlays * 3 + totalSaves * 10),
        genres: Array.from(val.genres),
        topTrackIds: val.tracks.slice(0, 5).map(t => t.id),
        albumIds: [],
        velocity: totalPlays > 500 ? '+35% Velocity' : 'Trending Now'
      });
    });

    return dynamicArtists;
  }

  /**
   * Get specific artist by ID or Name
   */
  public static async getArtistById(artistId: string): Promise<Artist | null> {
    const artists = await this.getArtists();
    const match = artists.find(a => a.id === artistId || a.name.toLowerCase() === artistId.toLowerCase());
    return match || null;
  }

  /**
   * Fetch all user-created playlists (purges legacy dummy playlists automatically)
   */
  public static async getPlaylists(): Promise<Playlist[]> {
    let local: Playlist[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '[]');
    local = local.filter(p => !isDummyPlaylist(p));
    localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(local));

    if (!db) return local;

    try {
      const snap = await getDocs(collection(db, 'playlists'));
      if (!snap.empty) {
        const remote: Playlist[] = [];
        const toPurge: string[] = [];

        snap.docs.forEach(d => {
          const pl = { id: d.id, ...d.data() } as Playlist;
          if (isDummyPlaylist(pl)) {
            toPurge.push(d.id);
          } else {
            remote.push(pl);
          }
        });

        // Asynchronously purge dummy playlists from Firestore
        toPurge.forEach(id => {
          deleteDoc(doc(db!, 'playlists', id)).catch(() => {});
        });

        localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(remote));
        return remote;
      }
      return local;
    } catch (e) {
      console.warn('Firestore fetch playlists failed, using local cache', e);
      return local;
    }
  }

  /**
   * Save or update a playlist
   */
  public static async savePlaylist(playlist: Playlist): Promise<void> {
    if (isDummyPlaylist(playlist)) return;

    const local = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '[]');
    const updated = [playlist, ...local.filter((p: Playlist) => p.id !== playlist.id)];
    localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(updated));

    if (db) {
      try {
        await setDoc(doc(db, 'playlists', playlist.id), playlist);
      } catch (e) {
        console.warn('Firestore save playlist failed', e);
      }
    }
  }

  /**
   * Delete a playlist
   */
  public static async deletePlaylist(playlistId: string): Promise<void> {
    const local = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '[]');
    const updated = local.filter((p: Playlist) => p.id !== playlistId);
    localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(updated));

    if (db) {
      try {
        await deleteDoc(doc(db, 'playlists', playlistId));
      } catch (e) {
        console.warn('Firestore delete playlist failed', e);
      }
    }
  }

  /**
   * Add a track to a playlist
   */
  public static async addTrackToPlaylist(playlistId: string, trackId: string): Promise<Playlist | null> {
    const playlists = await this.getPlaylists();
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return null;

    if (!playlist.trackIds.includes(trackId)) {
      const updatedPlaylist: Playlist = {
        ...playlist,
        trackIds: [...playlist.trackIds, trackId],
        updatedAt: Date.now()
      };
      await this.savePlaylist(updatedPlaylist);
      return updatedPlaylist;
    }
    return playlist;
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
  public static async getUsers(): Promise<UserProfile[]> {
    const local = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    if (!db) return local;

    try {
      const snap = await getDocs(collection(db, 'users'));
      if (!snap.empty) {
        const remote = snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile));
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(remote));
        return remote;
      }
      return local;
    } catch (e) {
      console.warn('Firestore fetch users failed, using local cache', e);
      return local;
    }
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
   * Google Sign-In via Firebase Auth
   */
  public static async loginWithGoogle(): Promise<UserProfile> {
    if (!auth) {
      initFirebase();
    }
    if (!auth) {
      throw new Error('Firebase Auth is not initialized. Check your .env credentials.');
    }

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const userCredential = await signInWithPopup(auth, provider);
      const fbUser = userCredential.user;

      // Construct user profile immediately
      const existing = await this.getUserById(fbUser.uid);
      const userProfile: UserProfile = {
        id: fbUser.uid,
        name: fbUser.displayName || existing?.name || 'Music Lover',
        email: fbUser.email || existing?.email || undefined,
        avatar: fbUser.photoURL || existing?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${fbUser.uid}`,
        isOnboarded: existing ? existing.isOnboarded : false,
        selectedGenres: existing ? existing.selectedGenres : [],
        selectedVibes: existing ? existing.selectedVibes : [],
        likedTrackIds: existing ? existing.likedTrackIds : [],
        savedPlaylistIds: existing ? existing.savedPlaylistIds : [],
        recentTrackIds: existing ? existing.recentTrackIds : []
      };

      // Save to local storage & Firestore immediately
      await this.saveUserSync(userProfile);
      return userProfile;
    } catch (err: any) {
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
    }
  }

  /**
   * Demo / Guest account with instant local & Firestore persistence
   */
  public static async loginWithDemo(name = 'Dhruv'): Promise<UserProfile> {
    const demoId = 'user_guest_' + Math.random().toString(36).substring(2, 7);
    const demoProfile: UserProfile = {
      id: demoId,
      name,
      email: `${name.toLowerCase().replace(/\s+/g, '')}@spotify-cloud.local`,
      avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80`,
      isOnboarded: true,
      selectedGenres: [],
      selectedVibes: [],
      likedTrackIds: [],
      savedPlaylistIds: [],
      recentTrackIds: []
    };
    await this.saveUserSync(demoProfile);
    return demoProfile;
  }

  /**
   * Helper to sync user profile across localStorage and Firestore
   */
  private static async saveUserSync(user: UserProfile): Promise<void> {
    const local = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const updated = [user, ...local.filter((u: UserProfile) => u.id !== user.id)];
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updated));

    if (db) {
      try {
        await setDoc(doc(db, 'users', user.id), user, { merge: true });
      } catch (e) {
        console.warn('Firestore user sync warning:', e);
      }
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
    const current = await this.getUsers();
    const updated = current.filter(u => u.id !== userId);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updated));

    if (db) {
      try {
        await deleteDoc(doc(db, 'users', userId));
      } catch (e) {
        console.warn('Failed to delete user in Firestore', e);
      }
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
      try {
        await setDoc(doc(db, 'telemetry', event.id), event);
      } catch (e) {
        console.warn('Firestore telemetry write warning', e);
      }
    }
  }

  /**
   * Get all Telemetry Events
   */
  public static async getTelemetryEvents(): Promise<TelemetryEvent[]> {
    if (db) {
      try {
        const q = query(collection(db, 'telemetry'), orderBy('timestamp', 'desc'), limit(100));
        const snap = await getDocs(q);
        if (!snap.empty) {
          return snap.docs.map(d => ({ id: d.id, ...d.data() } as TelemetryEvent));
        }
      } catch (e) {
        console.warn('Firestore fetch telemetry failed', e);
      }
    }

    const local = localStorage.getItem(STORAGE_KEYS.EVENTS);
    return local ? JSON.parse(local) : [];
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
      try {
        await setDoc(doc(db, 'device_sessions', session.id), session, { merge: true });
      } catch (e) {
        console.warn('Firestore device session warning', e);
      }
    }
  }

  /**
   * Realtime listener for Device Sessions
   */
  public static subscribeDeviceSessions(callback: (sessions: DeviceSession[]) => void): () => void {
    if (db) {
      try {
        return onSnapshot(collection(db, 'device_sessions'), (snap) => {
          const sessions = snap.docs.map(d => ({ id: d.id, ...d.data() } as DeviceSession));
          callback(sessions);
        });
      } catch (e) {
        console.warn('Firestore device sessions listener error', e);
      }
    }
    return () => {};
  }
}
