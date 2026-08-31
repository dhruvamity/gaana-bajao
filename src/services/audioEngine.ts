import { AcousticAttributes } from '../types';

export class AudioEngine {
  private audio: HTMLAudioElement;
  /** Set once the analyser is known to break playback for this engine. */
  private analyserUnavailable = false;
  /** In-flight enableAnalyser promise; concurrent calls share it. */
  private _analyserPromise: Promise<boolean> | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private isContextInitialized = false;
  private isDestroyed = false;
  private currentRawUrl: string = '';

  // Bound listener references, kept so destroy() can detach them
  private readonly listeners: { [K in keyof HTMLMediaElementEventMap]?: EventListener } = {};

  // Listeners
  private onTimeUpdateCallback?: (currentTime: number, duration: number) => void;
  private onEndedCallback?: () => void;
  private onPlayCallback?: () => void;
  private onPauseCallback?: () => void;
  private onErrorCallback?: (err: any) => void;

  constructor() {
    this.audio = this.createElement();
    this.setupListeners();
  }

  private createElement(): HTMLAudioElement {
    const el = new Audio();
    el.preload = 'metadata';
    // NOTE: `crossOrigin` is deliberately NOT set here.
    //
    // It is only needed to make a cross-origin resource readable by the Web
    // Audio API. We no longer route playback through Web Audio by default (see
    // enableAnalyser), and setting it has a real cost: if the media host does
    // not return Access-Control-Allow-Origin, the element refuses to load the
    // resource at all and fails with MEDIA_ELEMENT_ERROR code 4.
    return el;
  }

  private setupListeners() {
    this.listeners.timeupdate = () => {
      this.onTimeUpdateCallback?.(this.audio.currentTime, this.audio.duration || 0);
    };
    this.listeners.durationchange = () => {
      this.onTimeUpdateCallback?.(this.audio.currentTime, this.audio.duration || 0);
    };
    this.listeners.loadedmetadata = () => {
      this.onTimeUpdateCallback?.(this.audio.currentTime, this.audio.duration || 0);
    };
    this.listeners.ended = () => {
      this.onEndedCallback?.();
    };
    this.listeners.play = () => {
      // Resume a suspended context if the analyser is in use; never create one
      // here, because attaching a Web Audio graph can silence the output.
      void this.audioContext?.resume().catch(() => {});
      this.onPlayCallback?.();
    };
    this.listeners.pause = () => {
      this.onPauseCallback?.();
    };
    this.listeners.error = () => {
      this.onErrorCallback?.(this.audio.error);
    };

    for (const [event, handler] of Object.entries(this.listeners)) {
      this.audio.addEventListener(event, handler as EventListener);
    }
  }

  /**
   * Fully release every resource this engine owns: media element listeners,
   * the media element itself, the Web Audio graph and the AudioContext.
   *
   * Browsers cap a page at a small number of concurrent AudioContexts
   * (6 in Chrome), so an engine that is discarded without close() being
   * called permanently consumes one of those slots.
   */
  public destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    // Detach callbacks first so teardown does not emit events into React
    this.onTimeUpdateCallback = undefined;
    this.onEndedCallback = undefined;
    this.onPlayCallback = undefined;
    this.onPauseCallback = undefined;
    this.onErrorCallback = undefined;

    for (const [event, handler] of Object.entries(this.listeners)) {
      this.audio.removeEventListener(event, handler as EventListener);
    }

    try {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load(); // aborts any in-flight network request
    } catch {
      // element already torn down
    }

    void this.teardownGraph();
  }

  /**
   * Attach a Web Audio analyser so the spectrum visualiser has real data.
   *
   * This is opt-in and self-verifying because it can silence playback outright.
   * `createMediaElementSource` re-routes a media element's output through the
   * audio graph, and for cross-origin media the browser silences that output
   * unless the resource is CORS-clean. Measured against a CORS-enabled origin,
   * every graph-attached variant produced pure silence (analyser peak
   * -Infinity) while the element reported healthy playback with currentTime
   * advancing — audio that looks like it is playing but cannot be heard.
   *
   * So: attach, then confirm signal actually reaches the analyser. If it does
   * not, tear the graph down and restore direct playback.
   *
   * @returns true if the analyser is live and producing data.
   */
  public async enableAnalyser(): Promise<boolean> {
    if (this.isDestroyed) return false;
    if (this.isContextInitialized) return true;
    if (this.analyserUnavailable) return false;
    // Re-entrancy guard: if a call is already in flight, share its promise
    // instead of racing. A second concurrent call used to throw
    // InvalidStateError on createMediaElementSource, and its catch block
    // tore down the first call's analyser.
    if (this._analyserPromise) return this._analyserPromise;

    this._analyserPromise = this._doEnableAnalyser();
    try {
      return await this._analyserPromise;
    } finally {
      this._analyserPromise = null;
    }
  }

  private async _doEnableAnalyser(): Promise<boolean> {

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) {
      this.analyserUnavailable = true;
      return false;
    }

    try {
      this.audioContext = new AudioCtx();
      await this.audioContext.resume().catch(() => {});

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.8;

      this.sourceNode = this.audioContext.createMediaElementSource(this.audio);
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      this.isContextInitialized = true;
    } catch (e) {
      console.warn('Analyser unavailable:', e);
      this.analyserUnavailable = true;
      await this.teardownGraph();
      return false;
    }

    // Only meaningful to verify while audio is actually playing.
    if (this.audio.paused) return true;

    const hasSignal = await this.waitForSignal();
    if (!hasSignal) {
      console.warn(
        'Audio graph silenced this source (likely cross-origin media without ' +
        'usable CORS). Restoring direct playback; spectrum visualiser disabled.'
      );
      this.analyserUnavailable = true;
      await this.restoreDirectPlayback();
      return false;
    }
    return true;
  }

  /**
   * Poll the analyser for a short window; resolves true as soon as any energy
   * appears, false if the window elapses in silence.
   *
   * Deliberately timer-based rather than requestAnimationFrame: rAF does not
   * fire at all in a hidden or backgrounded tab, which would leave this promise
   * pending forever. Timers are throttled there but still fire, so the check
   * always terminates.
   */
  private waitForSignal(timeoutMs = 800): Promise<boolean> {
    return new Promise(resolve => {
      if (!this.analyser) return resolve(false);
      const buffer = new Uint8Array(this.analyser.frequencyBinCount);
      const started = Date.now();
      let timer = 0;

      const finish = (result: boolean) => {
        window.clearInterval(timer);
        resolve(result);
      };

      const check = () => {
        if (this.isDestroyed || !this.analyser) return finish(false);
        this.analyser.getByteFrequencyData(buffer);
        for (let i = 0; i < buffer.length; i++) {
          if (buffer[i] > 0) return finish(true);
        }
        if (Date.now() - started >= timeoutMs) return finish(false);
      };

      timer = window.setInterval(check, 50);
      check();
    });
  }

  /**
   * A MediaElementAudioSourceNode cannot be detached from its element, so the
   * only way back to audible output is a fresh element. Rebuild it and resume
   * from the same position so the listener hears at most a brief gap.
   */
  private async restoreDirectPlayback(): Promise<void> {
    const { currentTime, volume, paused } = this.audio;
    const url = this.currentRawUrl;

    for (const [event, handler] of Object.entries(this.listeners)) {
      this.audio.removeEventListener(event, handler as EventListener);
    }
    try {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
    } catch {
      // element already detached
    }

    await this.teardownGraph();

    this.audio = this.createElement();
    this.setupListeners();
    this.audio.volume = volume;
    this.currentRawUrl = '';
    this.setSource(url);

    const resumeAt = () => {
      try {
        this.audio.currentTime = currentTime;
      } catch {
        // seek before metadata is ready; the loadedmetadata handler retries
      }
      if (!paused) void this.audio.play().catch(() => {});
    };
    if (this.audio.readyState >= 1) resumeAt();
    else this.audio.addEventListener('loadedmetadata', resumeAt, { once: true });
  }

  private async teardownGraph(): Promise<void> {
    try {
      this.sourceNode?.disconnect();
      this.analyser?.disconnect();
    } catch {
      // already disconnected
    }
    try {
      await this.audioContext?.close();
    } catch {
      // already closed
    }
    this.sourceNode = null;
    this.analyser = null;
    this.audioContext = null;
    this.isContextInitialized = false;
  }

  /** True when a live analyser is attached and producing data. */
  public hasAnalyser(): boolean {
    return this.isContextInitialized && !!this.analyser;
  }

  public setSource(url: string, { force = false }: { force?: boolean } = {}): void {
    if (!force && this.currentRawUrl === url) return;
    this.currentRawUrl = url;
    this.audio.src = url;
    this.audio.load();
  }

  /** URL currently loaded into the media element, or '' if none. */
  public getSource(): string {
    return this.currentRawUrl;
  }

  public async play(): Promise<void> {
    if (this.isDestroyed) return;
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    return this.audio.play();
  }

  public pause(): void {
    this.audio.pause();
  }

  public seek(seconds: number): void {
    this.audio.currentTime = seconds;
  }

  public setVolume(volume: number): void {
    this.audio.volume = Math.max(0, Math.min(1, volume));
  }

  public getCurrentTime(): number {
    return this.audio.currentTime;
  }

  public getDuration(): number {
    return this.audio.duration || 0;
  }

  public isPaused(): boolean {
    return this.audio.paused;
  }

  /**
   * Returns normalized frequency data array [0..255] for glassmorphic visualizers
   */
  public getFrequencyData(): Uint8Array {
    if (!this.analyser) {
      return new Uint8Array(32).fill(0);
    }
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  // Set callbacks
  public setCallbacks(callbacks: {
    onTimeUpdate?: (currentTime: number, duration: number) => void;
    onEnded?: () => void;
    onPlay?: () => void;
    onPause?: () => void;
    onError?: (err: any) => void;
  }) {
    this.onTimeUpdateCallback = callbacks.onTimeUpdate;
    this.onEndedCallback = callbacks.onEnded;
    this.onPlayCallback = callbacks.onPlay;
    this.onPauseCallback = callbacks.onPause;
    this.onErrorCallback = callbacks.onError;
  }

  /**
   * Extract exact duration from an uploaded audio file using AudioContext
   */
  public static async getAudioDurationAndAcoustics(file: File): Promise<{
    duration: number;
    acoustics: AcousticAttributes;
  }> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const exactDuration = Math.round(audioBuffer.duration);
      const channelData = audioBuffer.getChannelData(0);

      let sumSquares = 0;
      let peak = 0;

      // Sample 80,000 points across the track for energy & valence estimation
      const sampleCount = 80000;
      const step = Math.max(1, Math.floor(channelData.length / sampleCount));
      let sampled = 0;

      for (let i = 0; i < channelData.length; i += step) {
        const val = Math.abs(channelData[i]);
        sumSquares += val * val;
        if (val > peak) peak = val;
        sampled++;
      }

      const rms = Math.sqrt(sumSquares / Math.max(1, sampled));
      
      const energy = Math.min(0.98, Math.max(0.15, rms * 4.2));
      const valence = Math.min(0.95, Math.max(0.25, (peak * 0.5 + rms * 2.0)));
      const tempo = Math.round(85 + energy * 55);
      const danceability = Math.min(0.95, Math.max(0.3, energy * 0.85 + valence * 0.15));
      const acousticness = Math.max(0.05, 1.0 - energy * 0.9);

      await ctx.close();

      return {
        duration: exactDuration,
        acoustics: {
          tempo,
          energy: parseFloat(energy.toFixed(2)),
          valence: parseFloat(valence.toFixed(2)),
          danceability: parseFloat(danceability.toFixed(2)),
          acousticness: parseFloat(acousticness.toFixed(2)),
          key: 'Auto-Detected'
        }
      };
    } catch (e) {
      console.warn('Audio decoding fallback:', e);
      return {
        duration: 180,
        acoustics: {
          tempo: 120,
          energy: 0.75,
          valence: 0.65,
          danceability: 0.7,
          acousticness: 0.15,
          key: 'Standard'
        }
      };
    }
  }
}
