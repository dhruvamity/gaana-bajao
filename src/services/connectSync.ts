import { DeviceSession, DeviceType, RemoteCommand } from '../types';
import { DatabaseService } from './firebase';

const MACHINE_ID_KEY = 'gaana_machine_id';

export class ConnectSyncService {
  /**
   * Generates or retrieves a persistent machine ID for this browser instance.
   */
  public static getOrCreateMachineId(): string {
    let id = localStorage.getItem(MACHINE_ID_KEY);
    if (!id) {
      id = 'm_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem(MACHINE_ID_KEY, id);
    }
    return id;
  }

  /**
   * Scopes device ID to the authenticated user ID.
   * This guarantees that documents in Firestore device_sessions collection are strictly
   * owned by the current user (uid) and prevents PERMISSION_DENIED collisions across accounts.
   */
  public static getDeviceId(userId?: string | null): string {
    const machineId = this.getOrCreateMachineId();
    if (userId) {
      return `${userId}_${machineId}`;
    }
    return `dev_${machineId}`;
  }

  /** Backwards-compatible alias */
  public static getOrCreateDeviceId(userId?: string | null): string {
    return this.getDeviceId(userId);
  }

  public static getDeviceType(): DeviceType {
    if (typeof navigator === 'undefined') return 'desktop';
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'tablet';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
      return 'mobile';
    }
    return 'desktop';
  }

  public static getDeviceName(): string {
    if (typeof navigator === 'undefined') return 'Web Player';
    const ua = navigator.userAgent;
    const type = this.getDeviceType();

    // Detect browser
    let browser = 'Web';
    if (ua.includes('Edg/')) browser = 'Edge';
    else if (ua.includes('Chrome/')) browser = 'Chrome';
    else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';
    else if (ua.includes('Firefox/')) browser = 'Firefox';
    else if (ua.includes('OPR/') || ua.includes('Opera/')) browser = 'Opera';

    // Detect OS
    let os = 'PC';
    if (/iPhone/.test(ua)) os = 'iPhone';
    else if (/iPad/.test(ua)) os = 'iPad';
    else if (/Macintosh|Mac OS X/.test(ua)) os = 'Mac';
    else if (/Windows/.test(ua)) os = 'Windows';
    else if (/Android/.test(ua)) os = 'Android';
    else if (/Linux/.test(ua)) os = 'Linux';

    if (type === 'mobile') return `${os} (${browser})`;
    if (type === 'tablet') return `${os} Tablet (${browser})`;
    return `${os} Player (${browser})`;
  }

  /**
   * Broadcast current device state with strict type sanitization matching firestore.rules validSession.
   */
  public static async broadcastState(state: {
    userId?: string | null;
    isPlaying: boolean;
    currentTrackId?: string;
    progressSeconds: number;
    volume: number;
    isActivePlayback: boolean;
  }): Promise<void> {
    if (!state.userId) return;

    const deviceId = this.getDeviceId(state.userId);

    const safeProgress = typeof state.progressSeconds === 'number' && !isNaN(state.progressSeconds) && isFinite(state.progressSeconds)
      ? Math.max(0, Math.round(state.progressSeconds))
      : 0;

    const safeVolume = typeof state.volume === 'number' && !isNaN(state.volume) && isFinite(state.volume)
      ? Math.max(0, Math.min(1, Number(state.volume.toFixed(2))))
      : 0.85;

    const deviceName = (this.getDeviceName() || 'Web Player').substring(0, 200);

    const session: DeviceSession = {
      id: deviceId,
      userId: state.userId,
      name: deviceName,
      deviceType: this.getDeviceType(),
      isCurrentDevice: true,
      isActivePlayback: Boolean(state.isActivePlayback),
      currentTrackId: state.currentTrackId ?? '',
      progressSeconds: safeProgress,
      isPlaying: Boolean(state.isPlaying),
      volume: safeVolume,
      lastUpdated: Date.now()
    };

    await DatabaseService.updateDeviceSession(session);
  }

  /**
   * Send a remote command to another device (Spotify Connect style)
   */
  public static async sendRemoteCommand(targetDeviceId: string, command: RemoteCommand): Promise<void> {
    await DatabaseService.sendDeviceCommand(targetDeviceId, command);
  }

  /**
   * Unregister current device session (e.g. on logout or before unload)
   */
  public static async unregisterCurrentDevice(userId?: string | null): Promise<void> {
    const deviceId = this.getDeviceId(userId);
    await DatabaseService.deleteDeviceSession(deviceId);
  }

  /**
   * Listen for local cross-tab remote commands
   */
  public static onRemoteCommand(callback: (command: RemoteCommand) => void, userId?: string | null): () => void {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return () => {};
    const bc = new BroadcastChannel('gaana_device_command');
    bc.onmessage = (event) => {
      const myId = this.getDeviceId(userId);
      if (event.data?.targetDeviceId === myId && event.data?.command) {
        callback(event.data.command);
      }
    };
    return () => bc.close();
  }
}
