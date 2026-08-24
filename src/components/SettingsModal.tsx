import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  X, 
  Database, 
  Check, 
  RefreshCw, 
  Activity, 
  ShieldCheck, 
  Terminal,
  Trash2,
  Wand2
} from 'lucide-react';
import { initFirebase, DatabaseService } from '../services/firebase';
import { LibraryRepairPanel } from './LibraryRepairPanel';
import { TelemetryEvent } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [projectId, setProjectId] = useState('');
  const [storageBucket, setStorageBucket] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'library' | 'firebase' | 'telemetry'>('library');
  const [telemetryEvents, setTelemetryEvents] = useState<TelemetryEvent[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const saved = localStorage.getItem('gaana_firebase_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setApiKey(parsed.apiKey || '');
        setProjectId(parsed.projectId || '');
        setStorageBucket(parsed.storageBucket || '');
      } catch (_) {}
    }

    DatabaseService.getTelemetryEvents().then(setTelemetryEvents);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveFirebase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !projectId) return;

    const config = {
      apiKey,
      authDomain: `${projectId}.firebaseapp.com`,
      projectId,
      storageBucket: storageBucket || `${projectId}.appspot.com`,
      messagingSenderId: '123456789',
      appId: '1:123456789:web:abcdef'
    };

    localStorage.setItem('gaana_firebase_config', JSON.stringify(config));
    initFirebase(config);

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleClearData = () => {
    if (window.confirm('Reset all catalog and telemetry data back to seed defaults?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-none flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl glass-elevated border border-white/20 rounded-lg p-6 sm:p-8 shadow-card space-y-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-primary/20 text-primary border border-primary/30 flex items-center justify-center">
              <Settings size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Settings</h2>
              <p className="text-xs text-on-surface-variant">Cloud Database & Playback Preferences</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full glass-subtle text-on-surface-variant hover:text-white transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-2 bg-surface-container p-1 rounded border border-white/10">
          <button
            onClick={() => setActiveTab('library')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'library' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:text-white'
            }`}
          >
            <Wand2 size={14} />
            <span>Library Repair</span>
          </button>
          <button
            onClick={() => setActiveTab('firebase')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'firebase' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:text-white'
            }`}
          >
            <Database size={14} />
            <span>Firebase Cloud Config</span>
          </button>
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'telemetry' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:text-white'
            }`}
          >
            <Terminal size={14} />
            <span>Listening Activity Logs</span>
          </button>
        </div>

        {/* Tab 1: Library repair */}
        {activeTab === 'library' && <LibraryRepairPanel />}

        {/* Tab 2: Firebase Form */}
        {activeTab === 'firebase' && (
          <form onSubmit={handleSaveFirebase} className="space-y-4">
            <div className="p-3.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary font-medium flex items-center gap-2">
              <ShieldCheck size={16} className="flex-shrink-0" />
              <span>
                Optional: Paste your Firebase Firestore config here to sync playlists & data with friends in real-time. Leave blank to run offline.
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-on-surface-variant">API Key</label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3.5 py-2.5 rounded glass-panel border border-white/10 text-white text-xs placeholder-on-surface-variant focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-on-surface-variant">Project ID</label>
              <input
                type="text"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="gaana-bajao-app"
                className="w-full px-3.5 py-2.5 rounded glass-panel border border-white/10 text-white text-xs placeholder-on-surface-variant focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-on-surface-variant">Storage Bucket</label>
              <input
                type="text"
                value={storageBucket}
                onChange={(e) => setStorageBucket(e.target.value)}
                placeholder="gaana-bajao-app.appspot.com (optional)"
                className="w-full px-3.5 py-2.5 rounded glass-panel border border-white/10 text-white text-xs placeholder-on-surface-variant focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleClearData}
                className="px-4 py-2 rounded glass-subtle text-red-400 hover:bg-red-500/10 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Trash2 size={14} />
                <span>Reset Database</span>
              </button>

              <button
                type="submit"
                className="px-6 py-2.5 rounded bg-primary hover:bg-primary-fixed text-on-primary text-xs font-bold shadow-lg hover:scale-102 transition-all flex items-center gap-1.5"
              >
                {savedSuccess ? <Check size={14} /> : <RefreshCw size={14} />}
                <span>{savedSuccess ? 'Connected!' : 'Save & Connect'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Live Telemetry Stream */}
        {activeTab === 'telemetry' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-on-surface-variant">
              <span>Real-Time Interaction Logs (Theses 1–5)</span>
              <span>{telemetryEvents.length} events logged</span>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1.5 font-mono text-[11px] p-3 rounded-lg bg-black/40 border border-white/10">
              {telemetryEvents.length === 0 ? (
                <div className="text-center py-6 text-on-surface-variant">
                  No telemetry events logged yet. Play tracks to generate events.
                </div>
              ) : (
                telemetryEvents.map((evt) => (
                  <div key={evt.id} className="p-2 rounded-lg bg-white/5 flex items-center justify-between gap-2">
                    <span className="text-primary font-bold">{evt.action}</span>
                    <span className="text-on-surface-variant">{evt.trackId}</span>
                    <span className="text-tertiary">{evt.context?.activity}</span>
                    <span className="text-white/60">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
