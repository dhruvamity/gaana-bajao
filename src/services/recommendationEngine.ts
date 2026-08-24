import { Track, UserProfile, TimeOfDay, ActivityContext, TelemetryEvent, InteractionType, Shelf } from '../types';

// Friction Weights Matrix (Thesis 2)
export const FRICTION_WEIGHTS: Record<InteractionType, number> = {
  playlist_add: 5.0,
  share: 4.5,
  repeat_listen: 3.0,
  like: 2.5,
  unlike: -1.5,
  stream_complete: 1.2,
  stream_30s: 1.0,
  skip_early: -2.0,
  hide_track: -6.0
};

// Temporal decay rate (lambda per day)
const TIME_DECAY_LAMBDA = 0.05;

// Fatigue coefficient (Thesis 4)
const FATIGUE_BETA = 0.18;

export class RecommendationEngine {
  /**
   * Thesis 1: Evaluates playback duration and returns appropriate reward & interaction type
   */
  public static evaluatePlaybackDuration(durationPlayed: number, totalDuration: number, userInitiatedSkip: boolean): {
    action: InteractionType;
    reward: number;
  } {
    if (userInitiatedSkip && durationPlayed < 30) {
      return { action: 'skip_early', reward: -2.0 };
    }
    if (durationPlayed >= Math.min(totalDuration * 0.9, totalDuration - 5)) {
      return { action: 'stream_complete', reward: 1.2 };
    }
    if (durationPlayed >= 30) {
      return { action: 'stream_30s', reward: 1.0 };
    }
    return { action: 'stream_30s', reward: 0.5 };
  }

  /**
   * Thesis 2: Compute Composite Interaction Score S(u, i) with Friction & Temporal Decay
   */
  public static computeCompositeScore(
    track: Track,
    events: TelemetryEvent[],
    userId: string
  ): number {
    const userEvents = events.filter(e => e.userId === userId && e.trackId === track.id);
    const now = Date.now();

    let totalScore = track.frictionScore || 0;

    for (const event of userEvents) {
      const weight = FRICTION_WEIGHTS[event.action] || 0;
      const daysAgo = (now - event.timestamp) / (1000 * 60 * 60 * 24);
      const decay = Math.exp(-TIME_DECAY_LAMBDA * daysAgo);
      totalScore += weight * decay;
    }

    return Math.max(0, totalScore);
  }

  /**
   * Thesis 3: Contextual Co-Clustering & Localized Unranking
   */
  public static isLocallyUnranked(
    track: Track,
    events: TelemetryEvent[],
    userId: string,
    context: { timeOfDay: TimeOfDay; activity: ActivityContext }
  ): boolean {
    const contextEvents = events.filter(
      e => e.userId === userId &&
           e.trackId === track.id &&
           (e.context.timeOfDay === context.timeOfDay || e.context.activity === context.activity)
    );

    if (contextEvents.length < 3) return false;

    const skips = contextEvents.filter(e => e.action === 'skip_early').length;
    const skipRate = skips / contextEvents.length;

    // Suppress if skip rate in this specific context exceeds 75%
    return skipRate > 0.75;
  }

  /**
   * Thesis 5: Early Lifecycle 24h Velocity Booster
   */
  public static computeEarlyVelocity(track: Track): { velocity: number; isBoosted: boolean } {
    const ageHours = (Date.now() - track.createdAt) / (1000 * 3600);
    
    if (ageHours <= 24 && ageHours >= 0) {
      const skipRate = track.skipCount / Math.max(1, track.playCount + track.skipCount);
      // v = (Day1Streams + 2 * Saves) / delta_t
      const rawVelocity = (track.playCount + 2 * track.saveCount) / Math.max(1, ageHours);
      
      const isBoosted = rawVelocity > 5.0 && skipRate < 0.25;
      return { velocity: rawVelocity, isBoosted };
    }

    return { velocity: 0, isBoosted: false };
  }

  /**
   * Thesis 4: Fatigue Regularization
   */
  public static computeFatigueMultiplier(unsavedImpressions: number): number {
    return Math.exp(-FATIGUE_BETA * Math.max(0, unsavedImpressions));
  }

  /**
   * Acoustic match score between track and target mood/activity
   */
  public static scoreAcousticAffinity(
    track: Track,
    user: UserProfile,
    activity: ActivityContext,
    timeOfDay: TimeOfDay
  ): number {
    let score = 0.5;

    // Target profiles based on context
    let targetEnergy = 0.6;
    let targetValence = 0.6;

    if (activity === 'workout') {
      targetEnergy = 0.9;
      targetValence = 0.8;
    } else if (activity === 'focus') {
      targetEnergy = 0.45;
      targetValence = 0.5;
    } else if (activity === 'chill' || timeOfDay === 'night') {
      targetEnergy = 0.3;
      targetValence = 0.5;
    } else if (activity === 'party') {
      targetEnergy = 0.85;
      targetValence = 0.85;
    }

    // Proximity in 2D acoustic space
    const energyDiff = Math.abs(track.acoustics.energy - targetEnergy);
    const valenceDiff = Math.abs(track.acoustics.valence - targetValence);
    const acousticMatch = 1 - (energyDiff * 0.6 + valenceDiff * 0.4);

    score += acousticMatch * 0.4;

    // Genre Affinity matching
    if (user.tasteVector?.genreAffinities && user.tasteVector.genreAffinities[track.genre]) {
      score += user.tasteVector.genreAffinities[track.genre] * 0.3;
    }

    // Liked tracks boost
    if (user.likedTrackIds.includes(track.id)) {
      score += 0.3;
    }

    return Math.min(1.0, score);
  }

  /**
   * BaRT Orchestrator: Generate 2D Contextual Home Shelves
   */
  public static generateHomeShelves(
    catalog: Track[],
    user: UserProfile,
    events: TelemetryEvent[],
    context: { timeOfDay: TimeOfDay; activity: ActivityContext; deviceType: any },
    epsilon: number = 0.15
  ): Shelf[] {
    const shelves: Shelf[] = [];

    // Filter out contextually unranked tracks (Thesis 3)
    const validCatalog = catalog.filter(
      track => !this.isLocallyUnranked(track, events, user.id, context)
    );

    // 1. Jump Back In / Recently Played Shelf
    const recentTracks = user.recentTrackIds
      .map(id => validCatalog.find(t => t.id === id))
      .filter((t): t is Track => Boolean(t));

    if (recentTracks.length > 0) {
      shelves.push({
        id: 'shelf-recent',
        title: 'Jump Back In',
        subtitle: 'Pick up where your session left off',
        tracks: recentTracks.slice(0, 6),
        type: 'recent'
      });
    }

    // 2. Fresh Releases / Release Radar Shelf
    const velocityCandidates = validCatalog.map(track => {
      const { velocity, isBoosted } = this.computeEarlyVelocity(track);
      return { track, velocity, isBoosted };
    }).sort((a, b) => b.velocity - a.velocity);

    const boostedTracks = velocityCandidates
      .filter(c => c.isBoosted || (Date.now() - c.track.createdAt) < 86400000 * 2)
      .map(c => ({
        ...c.track,
        recommendationReason: `🔥 Trending Release`
      }));

    if (boostedTracks.length > 0) {
      shelves.push({
        id: 'shelf-radar',
        title: 'Release Radar',
        subtitle: 'Fresh drops and trending releases this week',
        tracks: boostedTracks.slice(0, 6),
        badge: 'FRESH',
        type: 'radar'
      });
    }

    // 3. Contextual Vibe Shelf
    const contextualScored = validCatalog.map(track => {
      const baseAffinity = this.scoreAcousticAffinity(track, user, context.activity, context.timeOfDay);
      const compositeScore = this.computeCompositeScore(track, events, user.id);
      const fatigue = this.computeFatigueMultiplier(track.playCount > 10 && !user.likedTrackIds.includes(track.id) ? 3 : 0);
      
      let finalScore = (baseAffinity * 0.6 + (compositeScore / 500) * 0.4) * fatigue;

      // Epsilon exploration
      if (Math.random() < epsilon) {
        finalScore += Math.random() * 0.4;
      }

      return {
        track: {
          ...track,
          recommendationReason: `${Math.round(baseAffinity * 100)}% Match • ${context.activity.toUpperCase()}`
        },
        score: finalScore
      };
    }).sort((a, b) => b.score - a.score);

    const contextTitle = context.activity === 'focus' ? 'Deep Focus & Flow' :
      context.activity === 'workout' ? 'High Energy Workout' :
      context.activity === 'chill' ? 'Chill & Unwind' :
      context.timeOfDay === 'night' ? 'Late Night Atmosphere' : 'Daily Recommendations';

    shelves.push({
      id: 'shelf-context',
      title: contextTitle,
      subtitle: `Tuned for your ${context.activity} session`,
      tracks: contextualScored.map(s => s.track).slice(0, 6),
      type: 'context'
    });

    // 4. Made For You Shelf
    const userGenres = user.selectedGenres.length > 0 ? user.selectedGenres : ['Electronic', 'Synthwave', 'Lo-Fi'];
    const genreTracks = validCatalog
      .filter(t => userGenres.includes(t.genre))
      .map(t => ({
        ...t,
        recommendationReason: `✨ Recommended • ${t.genre}`
      }));

    shelves.push({
      id: 'shelf-discover',
      title: 'Made For ' + user.name,
      subtitle: `Curated based on your taste profile: ${userGenres.join(', ')}`,
      tracks: (genreTracks.length > 0 ? genreTracks : validCatalog).slice(0, 6),
      type: 'discover'
    });

    return shelves;
  }
}

