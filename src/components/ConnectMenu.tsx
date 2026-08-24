import React, { useState, useEffect } from 'react';
import { 
  Cast, 
  Laptop, 
  Smartphone, 
  Speaker, 
  Tablet, 
  X, 
  Check, 
  Users, 
  Volume2, 
  Radio, 
  ShieldCheck
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { DeviceSession, DeviceType } from '../types';
import { DatabaseService } from '../services/firebase';
import { ConnectSyncService } from '../services/connectSync';

export const ConnectMenu: React.FC = () => {
  const { isConnectOpen, setIsConnectOpen, volume, setVolume, isPlaying } = useAudio();
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [listenTogether, setListenTogether] = useState<boolean>(true);
  const currentDeviceId = ConnectSyncService.getOrCreateDeviceId();

  useEffect(() => {
    if (!isConnectOpen) return;

    const currentDevice: DeviceSession = {
      id: currentDeviceId,
      name: ConnectSyncService.getDeviceName(),
      deviceType: ConnectSyncService.getDeviceType(),
      isCurrentDevice: true,
      isActivePlayback: isPlaying,
      progressSeconds: 0,
      isPlaying,
      volume,
      lastUpdated: Date.now()
    };

    setSessions([currentDevice]);

    // Broadcast channel for cross-tab local discovery
    const channel = new BroadcastChannel('gaana_device_presence');
    channel.postMessage({ type: 'presence', device: currentDevice });

    channel.onmessage = (event) => {
      if (event.data?.type === 'presence' && event.data.device) {
        const remoteDevice = event.data.device as DeviceSession;
        if (remoteDevice.id !== currentDeviceId) {
          setSessions(prev => {
            const filtered = prev.filter(d => d.id !== remoteDevice.id);
            return [...filtered, { ...remoteDevice, isCurrentDevice: false }];
          });
        }
      }
    };

    const unsubscribe = DatabaseService.subscribeDeviceSessions((fetched) => {
      if (fetched.length > 0) {
        setSessions(prev => {
          const current = prev.find(p => p.id === currentDeviceId) || currentDevice;
          const others = fetched.filter(f => f.id !== currentDeviceId).map(f => ({ ...f, isCurrentDevice: false }));
          return [current, ...others];
        });
      }
    });

    return () => {
      channel.close();
      unsubscribe();
    };
  }, [isConnectOpen, currentDeviceId, isPlaying, volume]);

  if (!isConnectOpen) return null;

  const getDeviceIcon = (type: DeviceType) => {
    switch (type) {
      case 'mobile': return Smartphone;
      case 'speaker': return Speaker;
      case 'tablet': return Tablet;
      default: return Laptop;
    }
  };

  const handleSelectDevice = (device: DeviceSession) => {
    setSessions(prev => prev.map(s => ({
      ...s,
      isCurrentDevice: s.id === device.id,
      isActivePlayback: s.id === device.id
    })));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-none flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg glass-elevated border border-white/15 rounded-t-3xl sm:rounded-lg p-6 shadow-card space-y-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
              <Cast size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Connect to a Device</h2>
              <p className="text-xs text-on-surface-variant">Listen seamlessly across your devices</p>
            </div>
          </div>

          <button
            onClick={() => setIsConnectOpen(false)}
            className="p-2 rounded-full glass-subtle text-on-surface-variant hover:text-white transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Listen Together Room Sync Toggle */}
        <div className="p-4 rounded-lg glass-panel border border-primary/20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded bg-tertiary/20 text-tertiary border border-tertiary/30">
              <Users size={18} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Listen Together</h4>
              <p className="text-xs text-on-surface-variant">Sync queue in real-time with friends</p>
            </div>
          </div>

          <button
            onClick={() => setListenTogether(!listenTogether)}
            className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
              listenTogether ? 'bg-primary' : 'bg-white/20'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-background shadow-md transition-transform ${
                listenTogether ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Current Active Device Card */}
        <div className="space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Current Device</span>
          
          {sessions.filter(s => s.isCurrentDevice).map((device) => {
            const Icon = getDeviceIcon(device.deviceType);
            return (
              <div
                key={device.id}
                className="p-4 rounded-lg bg-primary/10 border border-primary/40 flex items-center justify-between"
              >
                <div className="flex items-center gap-3.5">
                  <div className="p-3 rounded bg-primary text-on-primary shadow-lg ">
                    <Icon size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      {device.name}
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-ping"></span>
                    </h4>
                    <p className="text-xs text-primary font-medium flex items-center gap-1 mt-0.5">
                      <Radio size={11} /> Playing on this device
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Volume2 size={16} className="text-primary" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-20 h-1 bg-white/20 rounded-lg cursor-pointer accent-primary"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Available Devices List */}
        <div className="space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
            Available Devices
          </span>

          <div className="space-y-2">
            {sessions.filter(s => !s.isCurrentDevice).map((device) => {
              const Icon = getDeviceIcon(device.deviceType);
              return (
                <button
                  key={device.id}
                  onClick={() => handleSelectDevice(device)}
                  className="w-full p-3.5 rounded-lg glass-panel border border-white/5 hover:border-primary/40 hover:bg-white/5 flex items-center justify-between text-left transition-all group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 rounded glass-subtle text-on-surface-variant group-hover:text-primary transition-colors">
                      <Icon size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white group-hover:text-primary transition-colors">
                        {device.name}
                      </h4>
                      <p className="text-xs text-on-surface-variant capitalize">{device.deviceType} • Online</p>
                    </div>
                  </div>

                  <span className="text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Switch
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-on-surface-variant font-medium">
          <span className="flex items-center gap-1 text-green-400">
            <ShieldCheck size={13} /> Synchronized Playback
          </span>
        </div>
      </div>
    </div>
  );
};
