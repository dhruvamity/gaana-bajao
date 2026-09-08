import React, { useState } from 'react';
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
  ShieldCheck,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  ArrowRightLeft
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { DeviceSession, DeviceType } from '../types';
import { ConnectSyncService } from '../services/connectSync';

export const ConnectMenu: React.FC = () => {
  const { 
    isConnectOpen, 
    setIsConnectOpen, 
    volume, 
    setVolume, 
    isPlaying,
    currentTrack,
    remoteActiveDevice,
    connectedDevices,
    transferPlaybackToDevice,
    sendRemoteCommand,
    takeOverPlaybackHere
  } = useAudio();

  const [listenTogether, setListenTogether] = useState<boolean>(false);
  const currentDeviceId = ConnectSyncService.getOrCreateDeviceId();
  const currentDeviceName = ConnectSyncService.getDeviceName();
  const currentDeviceType = ConnectSyncService.getDeviceType();

  if (!isConnectOpen) return null;

  const getDeviceIcon = (type: DeviceType) => {
    switch (type) {
      case 'mobile': return Smartphone;
      case 'speaker': return Speaker;
      case 'tablet': return Tablet;
      default: return Laptop;
    }
  };

  const isCurrentDevicePlaying = isPlaying && !remoteActiveDevice;
  const otherDevices = connectedDevices.filter(d => d.id !== currentDeviceId && d.id !== remoteActiveDevice?.id);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-surface-container-high rounded-t-3xl sm:rounded-lg p-6 shadow-card space-y-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-primary/20 border border-white/20 flex items-center justify-center text-primary">
              <Cast size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Connect to a Device</h2>
              <p className="text-xs text-on-surface-variant">Listen seamlessly across your devices</p>
            </div>
          </div>

          <button
            onClick={() => setIsConnectOpen(false)}
            className="p-2 rounded-full bg-white/5 text-on-surface-variant hover:text-white transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Remote Active Device (If playing on another place/device) */}
        {remoteActiveDevice && (
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-green-400 flex items-center gap-1.5">
              <Radio size={12} className="animate-pulse" />
              Active on another device
            </span>

            <div className="p-4 rounded-xl bg-gradient-to-r from-primary/20 via-surface-container to-surface-container border border-primary/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {React.createElement(getDeviceIcon(remoteActiveDevice.deviceType), {
                    size: 24,
                    className: 'text-primary'
                  })}
                  <div>
                    <h4 className="text-sm font-bold text-white">{remoteActiveDevice.name}</h4>
                    <p className="text-xs text-primary font-medium">Listening on this device</p>
                  </div>
                </div>

                <button
                  onClick={takeOverPlaybackHere}
                  className="px-3.5 py-1.5 rounded-full bg-primary hover:bg-primary-fixed text-on-primary font-bold text-xs flex items-center gap-1.5 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <ArrowRightLeft size={13} />
                  <span>Play here</span>
                </button>
              </div>

              {/* Remote Control Bar */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => sendRemoteCommand({ type: 'prev' })}
                    className="p-1.5 rounded-full hover:bg-white/10 text-on-surface-variant hover:text-white transition-colors cursor-pointer"
                    title="Previous on remote device"
                  >
                    <SkipBack size={16} fill="currentColor" />
                  </button>

                  <button
                    onClick={() => sendRemoteCommand({ type: remoteActiveDevice.isPlaying ? 'pause' : 'play' })}
                    className="p-2 rounded-full bg-white text-black hover:bg-white/90 shadow transition-all cursor-pointer"
                    title={remoteActiveDevice.isPlaying ? 'Pause remote device' : 'Resume remote device'}
                  >
                    {remoteActiveDevice.isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
                  </button>

                  <button
                    onClick={() => sendRemoteCommand({ type: 'next' })}
                    className="p-1.5 rounded-full hover:bg-white/10 text-on-surface-variant hover:text-white transition-colors cursor-pointer"
                    title="Next on remote device"
                  >
                    <SkipForward size={16} fill="currentColor" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <Volume2 size={15} className="text-on-surface-variant" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    defaultValue={remoteActiveDevice.volume}
                    onChange={(e) => sendRemoteCommand({ type: 'volume', volume: parseFloat(e.target.value) })}
                    className="w-20 h-1 bg-white/20 rounded-lg cursor-pointer accent-primary"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Current Device Card */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
            This Device
          </span>

          <div className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
            isCurrentDevicePlaying 
              ? 'bg-primary/10 border-primary/40' 
              : 'bg-surface-container border-white/10'
          }`}>
            <div className="flex items-center gap-3.5">
              <div className={`p-3 rounded-lg ${isCurrentDevicePlaying ? 'bg-primary text-on-primary shadow-lg' : 'bg-white/5 text-on-surface-variant'}`}>
                {React.createElement(getDeviceIcon(currentDeviceType), { size: 20 })}
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  {currentDeviceName}
                  {isCurrentDevicePlaying && (
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-ping"></span>
                  )}
                </h4>
                <p className={`text-xs font-medium mt-0.5 ${isCurrentDevicePlaying ? 'text-primary' : 'text-on-surface-variant'}`}>
                  {isCurrentDevicePlaying ? 'Playing on this device' : 'Ready to play'}
                </p>
              </div>
            </div>

            {isCurrentDevicePlaying ? (
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
            ) : (
              <button
                onClick={takeOverPlaybackHere}
                className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Play here
              </button>
            )}
          </div>
        </div>

        {/* Other Available Devices List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Available Devices ({otherDevices.length})
            </span>
            <span className="text-[10px] text-on-surface-variant">
              Logged in on same account
            </span>
          </div>

          {otherDevices.length === 0 ? (
            <div className="p-5 text-center rounded-lg bg-white/5 border border-white/5 space-y-1.5">
              <p className="text-xs text-white font-semibold">No other active devices detected</p>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Log in to Gaana-Bajao on another browser, phone, or laptop with this account.
                It will automatically appear here for remote playback and handoff.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {otherDevices.map((device) => {
                const Icon = getDeviceIcon(device.deviceType);
                return (
                  <button
                    key={device.id}
                    onClick={() => transferPlaybackToDevice(device.id)}
                    className="w-full p-3.5 rounded-xl bg-surface-container hover:border-primary/40 hover:bg-white/5 border border-white/5 flex items-center justify-between text-left transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 rounded-lg bg-white/5 text-on-surface-variant group-hover:text-primary transition-colors">
                        <Icon size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white group-hover:text-primary transition-colors">
                          {device.name}
                        </h4>
                        <p className="text-xs text-on-surface-variant capitalize">
                          {device.deviceType} • Online
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRightLeft size={13} />
                      <span>Switch</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-on-surface-variant font-medium">
          <span className="flex items-center gap-1.5 text-green-400">
            <ShieldCheck size={14} /> Synchronized Playback
          </span>
          <span className="text-[10px]">Amazon Music & Spotify Protocol</span>
        </div>
      </div>
    </div>
  );
};
