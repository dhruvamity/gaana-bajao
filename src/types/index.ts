export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';
export type ActivityContext = 'focus' | 'workout' | 'chill' | 'commute' | 'party';
export type DeviceType = 'desktop' | 'mobile' | 'speaker' | 'tablet';

export interface AcousticAttributes {
  tempo: number; // BPM: 60-180
  energy: number; // 0.0 - 1.0
  valence: number; // 0.0 - 1.0 (mood: sad/dark to happy/bright)
  danceability: number; // 0.0 - 1.0
  acousticness: number; // 0.0 - 1.0
  key?: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  /**
   * Firebase uid of the uploader. The catalog is shared for reading, but only
   * the uploader may modify or delete a track — security rules enforce this, so
   * the field must be set at creation and can never be reassigned.
   */
  ownerId?: string;
  /** Display name of the uploader, denormalised for attribution in the UI. */
  ownerName?: string;
  artistId?: string;
  album: string;
  duration: number; // in seconds
  audioUrl: string;
  coverUrl: string;
  genre: string;
  tags: string[];
  acoustics: AcousticAttributes;
  createdAt: number; // timestamp
  playCount: number;
  saveCount: number;
  skipCount: number;
  // Algorithmic telemetry cache
  earlyVelocity?: number; // 24h booster metric
  frictionScore?: number; // Composite interaction weight
  recommendationReason?: string; // e.g. "98% Acoustic Match", "Thesis 5 Boost"
}

export interface Artist {
  id: string;
  name: string;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  monthlyListeners: number;
  genres: string[];
  topTrackIds: string[];
  albumIds: string[];
  velocity: string; // e.g. "+34.8% this week"
}

export interface Playlist {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  trackIds: string[];
  ownerId: string;
  ownerName: string;
  collaborators?: { id: string; name: string; avatar: string }[];
  /**
   * Collaborator uids, kept alongside `collaborators` because security rules
   * cannot project a field out of an array of maps. Must always be the set of
   * `collaborators[].id`.
   */
  collaboratorIds?: string[];
  isAlgorithmic?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  avatar: string;
  bio?: string;
  pin?: string; // Optional 4-digit PIN lock for profile
  isOnboarded: boolean;
  selectedGenres: string[];
  selectedVibes: string[];
  likedTrackIds: string[];
  savedPlaylistIds: string[];
  recentTrackIds: string[];
  // Latent genre / acoustic preference vector
  tasteVector?: {
    energy: number;
    valence: number;
    danceability: number;
    genreAffinities: Record<string, number>;
  };
}

export type InteractionType = 
  | 'stream_30s'       // +1.0
  | 'stream_complete'  // +1.2
  | 'skip_early'       // -2.0
  | 'like'             // +2.5
  | 'unlike'           // -1.5
  | 'playlist_add'     // +5.0
  | 'share'            // +4.5
  | 'repeat_listen'    // +3.0
  | 'hide_track';      // -6.0

export interface TelemetryEvent {
  id: string;
  userId: string;
  trackId: string;
  action: InteractionType;
  durationPlayed: number;
  timestamp: number;
  context: {
    timeOfDay: TimeOfDay;
    activity: ActivityContext;
    deviceType: DeviceType;
  };
}

export interface DeviceSession {
  id: string;
  name: string;
  deviceType: DeviceType;
  isCurrentDevice: boolean;
  isActivePlayback: boolean;
  currentTrackId?: string;
  progressSeconds: number;
  isPlaying: boolean;
  volume: number;
  lastUpdated: number;
}

export interface Shelf {
  id: string;
  title: string;
  subtitle?: string;
  tracks: Track[];
  badge?: string;
  type: 'recent' | 'radar' | 'flow' | 'context' | 'artist' | 'discover';
}
