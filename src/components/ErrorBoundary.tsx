import React from 'react';
import { Music, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level error boundary: catches render throws so the whole app does not
 * blank out. A single unguarded render error used to produce a white screen
 * with no feedback — this at least shows what went wrong and offers a reload.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  handleClearCacheAndReload = () => {
    try {
      localStorage.removeItem('gaana_tracks_cache');
      localStorage.removeItem('gaana_playlists');
      localStorage.removeItem('gaana_active_track_id');
      localStorage.removeItem('gaana_queue');
      sessionStorage.clear();
    } catch (e) {
      console.warn('Failed to clear local storage cache', e);
    }
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-background flex flex-col items-center justify-center space-y-6 text-center px-6">
          <div className="w-20 h-20 rounded-2xl bg-surface-container flex items-center justify-center">
            <Music size={40} className="text-primary" />
          </div>
          <div className="space-y-2 max-w-md">
            <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-full bg-primary hover:bg-primary-fixed text-on-primary font-bold text-sm inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw size={16} />
              Reload app
            </button>
            <button
              onClick={this.handleClearCacheAndReload}
              className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-sm inline-flex items-center gap-2 transition-colors border border-white/10 cursor-pointer"
            >
              Reset Cache & Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
