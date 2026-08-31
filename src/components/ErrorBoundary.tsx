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
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-full bg-primary hover:bg-primary-fixed text-on-primary font-bold text-sm inline-flex items-center gap-2 transition-colors"
          >
            <RefreshCw size={16} />
            Reload app
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
