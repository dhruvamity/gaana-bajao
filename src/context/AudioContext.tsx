import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Track, TelemetryEvent, InteractionType } from '../types';
import { AudioEngine } from '../services/audioEngine';
import { DatabaseService } from '../services/firebase';
import { RecommendationEngine } from '../services/recommendationEngine';
import { ConnectSyncService } from '../services/connectSync';
import { useAuth } from './AuthContext';

interface AudioContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  queue: Track[];
  isShuffle: boolean;
  isRepeat: boolean;
  isNowPlayingOpen: boolean;
  isQueueOpen: boolean;
  isConnectOpen: boolean;
  /**
   * Why the current track will not play, or null. Set from the media element's
   * own error event, so a missing or unplayable source surfaces in the UI
   * instead of leaving the player claiming to be playing forever.
   */
  playbackError: string | null;
  /** Reads live analyser output. Call from your own animation frame. */
  getFrequencyData: () => Uint8Array;
  /**
   * Opt in to the spectrum analyser. Resolves false when it cannot be attached
   * without silencing playback, in which case the visualiser must degrade.
   */
  enableAnalyser: () => Promise<boolean>;
  
  // Actions
  playTrack: (track: Track, newQueue?: Track[]) => void;
  /**
   * Play `track`, or toggle play/pause when it is already the current track.
   * Track rows render a pause icon for the playing track; wiring them straight
   * to playTrack made that icon restart the song instead of pausing it.
   */
  playOrToggle: (track: Track, newQueue?: Track[]) => void;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (startIndex: number, endIndex: number) => void;
  clearQueue: () => void;
  
  // Modals / Drawers
  setIsNowPlayingOpen: (open: boolean) => void;
  setIsQueueOpen: (open: boolean) => void;
  setIsConnectOpen: (open: boolean) => void;
  
  // Telemetry explicit actions
  logInteraction: (type: InteractionType, trackId?: string) => void;
}

/** How often a playing device republishes its position for Connect & Handoff. */
const PLAYBACK_HEARTBEAT_MS = 15000;

/**
 * How long the volume must be still before its new value is published.
 *
 * Volume is a continuous control: one slider drag emits an input event per
 * pointer sample. Broadcasting each one turned a single ~1.8s drag into 40
 * Firestore writes plus 40 synchronous localStorage round trips, all carrying
 * an identical playback position.
 */
const VOLUME_SYNC_DEBOUNCE_MS = 600;

/**
 * Turn a MediaError code into something a listener can act on.
 *
 * Code 4 is the one that matters here: it is what the element reports when the
 * URL resolves but the bytes are not there — a deleted or expired object in
 * media storage. Track documents live in Firestore and are completely
 * independent of the blobs, so clearing storage leaves a full-looking library
 * in which nothing can play.
 */
function describeMediaError(code?: number): string {
  switch (code) {
    case 1: return 'Playback was interrupted.';
    case 2: return 'Network error while loading this track.';
    case 3: return 'This track could not be decoded — the file may be damaged.';
    case 4: return "This track's audio is missing from storage — it may have been deleted.";
    default: return 'This track could not be played.';
  }
}

/** Shared zero-filled buffer returned when no analyser is available. */
const EMPTY_FREQUENCY_DATA = new Uint8Array(32);

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, timeOfDay, activityContext, deviceType } = useAuth();
  
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(0.85);
  const [queue, setQueue] = useState<Track[]>([]);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [isRepeat, setIsRepeat] = useState<boolean>(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  
  // UI Panels
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState<boolean>(false);
  const [isQueueOpen, setIsQueueOpen] = useState<boolean>(false);
  const [isConnectOpen, setIsConnectOpen] = useState<boolean>(false);

  const audioEngineRef = useRef<AudioEngine | null>(null);
  const playStartTimeRef = useRef<number>(0);
  const hasLogged30sRef = useRef<boolean>(false);

  // Media events fire asynchronously, long after render. Routing them through a
  // ref lets the engine keep stable listeners for its whole lifetime while the
  // handlers still observe current state — so the engine never has to be rebuilt
  // (and torn down mid-playback) just to refresh a closure.
  const mediaHandlersRef = useRef<{
    onTimeUpdate: (currentTime: number, totalDuration: number) => void;
    onEnded: () => void;
    onPlay: () => void;
    onPause: () => void;
    onError: (err: unknown) => void;
  }>({
    onTimeUpdate: () => {},
    onEnded: () => {},
    onPlay: () => {},
    onPause: () => {},
    onError: () => {}
  });

  // Create the audio engine exactly once for the lifetime of the provider.
  //
  // This effect MUST NOT depend on any playback state. It previously depended on
  // [currentTrack, duration]; because its cleanup pauses the engine, selecting a
  // track paused the audio that had just been started and swapped the ref for a
  // fresh engine with no source — so playback never survived a track change.
  // The listeners registered here are stable delegates into mediaHandlersRef.
  useEffect(() => {
    const engine = new AudioEngine();
    audioEngineRef.current = engine;

    engine.setCallbacks({
      onTimeUpdate: (currentTime, totalDuration) =>
        mediaHandlersRef.current.onTimeUpdate(currentTime, totalDuration),
      onEnded: () => mediaHandlersRef.current.onEnded(),
      onPlay: () => mediaHandlersRef.current.onPlay(),
      onPause: () => mediaHandlersRef.current.onPause(),
      onError: (err) => mediaHandlersRef.current.onError(err)
    });

    return () => {
      engine.destroy();
      if (audioEngineRef.current === engine) {
        audioEngineRef.current = null;
      }
    };
  }, []);

  // Frequency data is deliberately NOT React state.
  //
  // It previously ran a requestAnimationFrame loop calling setState 60 times a
  // second; because it lived on the context value, every consumer in the app
  // re-rendered at 60fps — every track card, both sidebars, every mounted modal
  // — to feed 28 bars inside a modal that is usually closed. The loop also
  // rescheduled itself unconditionally, so it never stopped.
  //
  // Consumers now pull the data themselves from their own animation frame and
  // write it straight to the DOM.
  const getFrequencyData = useCallback((): Uint8Array => {
    return audioEngineRef.current?.getFrequencyData() ?? EMPTY_FREQUENCY_DATA;
  }, []);

  // Attaching the analyser re-routes playback through Web Audio, which silences
  // cross-origin media. It is therefore opt-in, requested only when a visualiser
  // is actually on screen, and the engine verifies audio still reaches the
  // output before keeping it.
  const enableAnalyser = useCallback(async (): Promise<boolean> => {
    return (await audioEngineRef.current?.enableAnalyser()) ?? false;
  }, []);

  // Broadcast state for Connect & Handoff sync.
  //
  // This must NOT depend on `progress`. It used to, and since progress updates
  // on every `timeupdate` (~4Hz) that meant a Firestore write and a synchronous
  // localStorage round trip four times a second — about 14,000 writes per hour
  // of listening, against a 20,000/day free-tier quota.
  //
  // Instead: broadcast on real state transitions, plus a low-frequency
  // heartbeat that reads the current position out of a ref.
  const progressRef = useRef(0);
  progressRef.current = progress;

  /* `volume` is read through a ref for exactly the reason `progress` is.
     While it was a dependency of broadcastNow, every volume change rebuilt the
     callback — which both fired an immediate broadcast AND tore down and
     restarted the 15s heartbeat interval, so continuous adjustment meant the
     heartbeat never matured once. */
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const userIdRef = useRef<string | undefined>(currentUser?.id);
  userIdRef.current = currentUser?.id;

  const broadcastNow = useCallback(() => {
    ConnectSyncService.broadcastState({
      userId: userIdRef.current,
      isPlaying,
      currentTrackId: currentTrack?.id,
      progressSeconds: progressRef.current,
      volume: volumeRef.current,
      isActivePlayback: isPlaying
    });
  }, [isPlaying, currentTrack?.id]);

  // Real state transitions: play/pause and track change.
  useEffect(() => {
    broadcastNow();
  }, [broadcastNow]);

  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(broadcastNow, PLAYBACK_HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [isPlaying, broadcastNow]);

  /* Volume settles into a single write. The first run is skipped so mounting
     does not publish a redundant broadcast alongside the transition effect
     above. */
  const volumeSettledRef = useRef(false);
  useEffect(() => {
    if (!volumeSettledRef.current) {
      volumeSettledRef.current = true;
      return;
    }
    const id = window.setTimeout(broadcastNow, VOLUME_SYNC_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [volume, broadcastNow]);

  const logInteractionInternal = useCallback(async (
    action: InteractionType,
    trackId?: string,
    durationPlayed?: number
  ) => {
    const targetTrackId = trackId || currentTrack?.id;
    if (!targetTrackId) return;

    const event: TelemetryEvent = {
      id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      userId: currentUser?.id || 'guest',
      trackId: targetTrackId,
      action,
      durationPlayed: durationPlayed || progress,
      timestamp: Date.now(),
      context: {
        timeOfDay,
        activity: activityContext,
        deviceType
      }
    };

    await DatabaseService.logTelemetry(event);
  }, [currentTrack?.id, currentUser?.id, timeOfDay, activityContext, deviceType, progress]);

  const logInteraction = (type: InteractionType, trackId?: string) => {
    logInteractionInternal(type, trackId);
  };

  /**
   * Start a track.
   *
   * `userInitiated` decides whether leaving the current track counts as a
   * skip. It is the single source of that judgement in the whole provider:
   * nextTrack() used to log a skip itself and then call through to here, which
   * logged the very same abandonment again — two identical events a
   * millisecond apart, and a doubled negative reward for the ranking engine
   * that reads them. It is also false when a track ends on its own, so a track
   * shorter than 30s no longer records both a completion and a skip.
   */
  const startTrack = (
    track: Track,
    newQueue?: Track[],
    { userInitiated = true }: { userInitiated?: boolean } = {}
  ) => {
    if (!audioEngineRef.current) return;

    /* Classify the abandoned track through the engine rather than re-deriving
       the 30s rule here. RecommendationEngine was imported but never called
       anywhere in the app; this makes the threshold single-sourced, so tuning
       Thesis 1 actually changes what the app records. */
    if (userInitiated && currentTrack && currentTrack.id !== track.id && isPlaying) {
      const { action } = RecommendationEngine.evaluatePlaybackDuration(progress, duration, true);
      if (action === 'skip_early') {
        logInteractionInternal('skip_early', currentTrack.id, progress);
      }
    }

    setCurrentTrack(track);
    setPlaybackError(null);
    hasLogged30sRef.current = false;
    playStartTimeRef.current = Date.now();

    if (newQueue) {
      setQueue(newQueue);
    } else if (!queue.some(t => t.id === track.id)) {
      setQueue([track, ...queue]);
    }

    audioEngineRef.current.setSource(track.audioUrl);
    audioEngineRef.current.play().catch(e => {
      // A rejected play() is usually the autoplay policy; the element's own
      // `error` event covers an unusable source and sets a better message.
      if (e?.name === 'NotAllowedError') {
        setIsPlaying(false);
        setPlaybackError('Press play to start — your browser blocked automatic playback.');
      }
      console.warn('Play request rejected', e);
    });
    setIsPlaying(true);
  };

  const playTrack = (track: Track, newQueue?: Track[]) => startTrack(track, newQueue);

  const playOrToggle = (track: Track, newQueue?: Track[]) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
      return;
    }
    playTrack(track, newQueue);
  };

  const togglePlay = () => {
    if (!audioEngineRef.current || !currentTrack) return;
    if (isPlaying) {
      audioEngineRef.current.pause();
    } else {
      audioEngineRef.current.play().catch(e => console.warn('Play error', e));
    }
  };

  const pause = () => audioEngineRef.current?.pause();
  const resume = () => audioEngineRef.current?.play();

  const handleTrackEnded = () => {
    if (isRepeat && currentTrack) {
      seek(0);
      // A repeat pass is a fresh listen, so the 30s reward can be earned again.
      hasLogged30sRef.current = false;
      resume();
      return;
    }
    advance({ userInitiated: false });
  };

  /**
   * Move to the next entry in the queue.
   *
   * Skip classification is left entirely to startTrack — see the note there.
   */
  const advance = ({ userInitiated }: { userInitiated: boolean }) => {
    if (queue.length === 0) return;
    const currentIndex = queue.findIndex(t => t.id === currentTrack?.id);

    let nextIndex = currentIndex + 1;
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    }

    if (nextIndex < queue.length) {
      startTrack(queue[nextIndex], undefined, { userInitiated });
    } else if (isRepeat) {
      startTrack(queue[0], undefined, { userInitiated });
    } else {
      setIsPlaying(false);
    }
  };

  const nextTrack = () => advance({ userInitiated: true });

  const prevTrack = () => {
    if (progress > 3) {
      seek(0);
      return;
    }
    if (queue.length === 0) return;
    const currentIndex = queue.findIndex(t => t.id === currentTrack?.id);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : queue.length - 1;
    playTrack(queue[prevIndex]);
  };

  const seek = (seconds: number) => {
    if (audioEngineRef.current) {
      audioEngineRef.current.seek(seconds);
      setProgress(seconds);
    }
  };

  const setVolume = (vol: number) => {
    setVolumeState(vol);
    if (audioEngineRef.current) {
      audioEngineRef.current.setVolume(vol);
    }
  };

  const toggleShuffle = () => setIsShuffle(prev => !prev);
  const toggleRepeat = () => setIsRepeat(prev => !prev);

  const addToQueue = (track: Track) => {
    setQueue(prev => [...prev, track]);
  };

  const removeFromQueue = (index: number) => {
    setQueue(prev => prev.filter((_, i) => i !== index));
  };

  const reorderQueue = (startIndex: number, endIndex: number) => {
    setQueue(prev => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result;
    });
  };

  const clearQueue = () => {
    if (currentTrack) {
      setQueue([currentTrack]);
    } else {
      setQueue([]);
    }
  };

  // Refresh the media-event handlers after every render so the stable listeners
  // registered on the engine always dispatch into current state.
  useEffect(() => {
    mediaHandlersRef.current = {
      onTimeUpdate: (currentTime, totalDuration) => {
        setProgress(currentTime);
        setDuration(totalDuration);

        // Thesis 1: 30-Second Binarized Reward Engine
        if (currentTime >= 30 && !hasLogged30sRef.current && currentTrack) {
          hasLogged30sRef.current = true;
          logInteractionInternal('stream_30s', currentTrack.id, currentTime);
        }
      },
      onEnded: () => {
        if (currentTrack) {
          logInteractionInternal('stream_complete', currentTrack.id, duration);
        }
        handleTrackEnded();
      },
      onPlay: () => setIsPlaying(true),
      onPause: () => setIsPlaying(false),
      onError: (err) => {
        /* Previously this only warned to the console: the element stopped, but
           isPlaying stayed true, so the bar kept showing a pause button over a
           timer frozen at 0:00 and nothing told the listener anything. */
        const code = (err as MediaError | null)?.code;
        setIsPlaying(false);
        setPlaybackError(describeMediaError(code));
        console.warn('Audio playback error', err);
      }
    };
  });

  return (
    <AudioContext.Provider
      value={{
        currentTrack,
        isPlaying,
        progress,
        duration,
        volume,
        queue,
        isShuffle,
        isRepeat,
        isNowPlayingOpen,
        isQueueOpen,
        isConnectOpen,
        playbackError,
        getFrequencyData,
        enableAnalyser,
        playTrack,
        playOrToggle,
        togglePlay,
        pause,
        resume,
        nextTrack,
        prevTrack,
        seek,
        setVolume,
        toggleShuffle,
        toggleRepeat,
        addToQueue,
        removeFromQueue,
        reorderQueue,
        clearQueue,
        setIsNowPlayingOpen,
        setIsQueueOpen,
        setIsConnectOpen,
        logInteraction
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) throw new Error('useAudio must be used within an AudioProvider');
  return context;
};
