import { DeviceSession, DeviceType } from '../types';
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

  public static getDeviceType(): DeviceType {
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
    const type = this.getDeviceType();
    if (type === 'mobile') return 'Personal Phone (Web)';
    if (type === 'tablet') return 'Tablet Player';
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    return isMac ? 'MacBook Pro (Chrome)' : 'Workstation PC (Web)';
  }

  /**
   * Broadcast current device state
   */
  public static async broadcastState(state: {
    isPlaying: boolean;
    currentTrackId?: string;
    progressSeconds: number;
    volume: number;
    isActivePlayback: boolean;
  }): Promise<void> {
    const session: DeviceSession = {
      id: this.deviceId,
      name: this.getDeviceName(),
      deviceType: this.getDeviceType(),
      isCurrentDevice: true,
      isActivePlayback: state.isActivePlayback,
      currentTrackId: state.currentTrackId,
      progressSeconds: state.progressSeconds,
      isPlaying: state.isPlaying,
      volume: state.volume,
      lastUpdated: Date.now()
    };

    await DatabaseService.updateDeviceSession(session);
  }
}
