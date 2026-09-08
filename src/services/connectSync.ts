import { DeviceSession, DeviceType, RemoteCommand } from '../types';
import { DatabaseService } from './firebase';

const DEVICE_ID_KEY = 'gaana_device_id';

export class ConnectSyncService {
  private static deviceId: string = ConnectSyncService.getOrCreateDeviceId();

  public static getOrCreateDeviceId(): string {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  }

  public static getDeviceId(): string {
    return this.deviceId;
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
   * Broadcast current device state.
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

    const session: DeviceSession = {
      id: this.deviceId,
      userId: state.userId,
      name: this.getDeviceName(),
      deviceType: this.getDeviceType(),
      isCurrentDevice: true,
      isActivePlayback: state.isActivePlayback,
      currentTrackId: state.currentTrackId ?? '',
      progressSeconds: state.progressSeconds,
      isPlaying: state.isPlaying,
      volume: state.volume,
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
  public static async unregisterCurrentDevice(): Promise<void> {
    await DatabaseService.deleteDeviceSession(this.deviceId);
  }

  /**
   * Listen for local cross-tab remote commands
   */
  public static onRemoteCommand(callback: (command: RemoteCommand) => void): () => void {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return () => {};
    const bc = new BroadcastChannel('gaana_device_command');
    bc.onmessage = (event) => {
      if (event.data?.targetDeviceId === this.deviceId && event.data?.command) {
        callback(event.data.command);
      }
    };
    return () => bc.close();
  }
}
