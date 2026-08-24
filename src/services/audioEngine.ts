import { AcousticAttributes } from '../types';
import { StorageService } from './storageService';

export class AudioEngine {
  private audio: HTMLAudioElement;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private isContextInitialized = false;
  private currentRawUrl: string = '';
  private currentObjectUrl: string | null = null;

  // Listeners
  private onTimeUpdateCallback?: (currentTime: number, duration: number) => void;
  private onEndedCallback?: () => void;
  private onPlayCallback?: () => void;
  private onPauseCallback?: () => void;
  private onErrorCallback?: (err: any) => void;

  constructor() {
    this.audio = new Audio();
    this.audio.crossOrigin = 'anonymous';
    this.audio.preload = 'metadata';

    this.setupListeners();
  }

  private setupListeners() {
    this.audio.addEventListener('timeupdate', () => {
      if (this.onTimeUpdateCallback) {
        this.onTimeUpdateCallback(this.audio.currentTime, this.audio.duration || 0);
      }
    });

    this.audio.addEventListener('ended', () => {
      if (this.onEndedCallback) {
        this.onEndedCallback();
      }
    });

    this.audio.addEventListener('play', () => {
      this.initAudioContext();
      if (this.onPlayCallback) this.onPlayCallback();
    });

    this.audio.addEventListener('pause', () => {
      if (this.onPauseCallback) this.onPauseCallback();
    });

    this.audio.addEventListener('error', (e) => {
      if (this.onErrorCallback) this.onErrorCallback(e);
    });
  }

  private initAudioContext() {
    if (this.isContextInitialized) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.8;

      this.sourceNode = this.audioContext.createMediaElementSource(this.audio);
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      this.isContextInitialized = true;
    } catch (e) {
      console.warn('Web Audio API Visualizer context setup warning:', e);
    }
  }

  public async setSource(url: string) {
    if (this.currentRawUrl === url) return;
    this.currentRawUrl = url;

    // Clean up previous blob object URL if any
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }

    let playableUrl = url;

    this.audio.src = playableUrl;
    this.audio.load();
  }

  public async play(): Promise<void> {
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
