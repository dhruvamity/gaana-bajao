import React, { useState } from 'react';
import { 
  Music, 
  ShieldCheck, 
  Radio, 
  Flame, 
  Zap, 
  ArrowRight,
  AlertCircle,
  User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AuthModal: React.FC = () => {
  const { loginWithGoogle, loginWithDemo } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isDemoLoggingIn, setIsDemoLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      // Don't show error if redirect is in progress (page will navigate away)
      if (err.message === 'REDIRECT_IN_PROGRESS') {
        return; // Keep spinner — page is redirecting
      }
      console.error('Google login error', err);
      
      // User-friendly error messages
      const msg = err.message || '';
      if (msg.includes('popup') || msg.includes('Pop-up')) {
        setError('Pop-up was blocked or closed. Please allow pop-ups for this site, then try again.');
      } else if (msg.includes('not enabled') || msg.includes('operation-not-allowed')) {
        setError('Google Sign-In is not enabled in Firebase Console. Go to Authentication → Sign-in method → Enable Google.');
      } else if (msg.includes('unauthorized-domain') || msg.includes('not authorized')) {
        setError('This domain is not authorized. Add "localhost" in Firebase Console → Authentication → Settings → Authorized Domains.');
      } else if (msg.includes('network') || msg.includes('Network')) {
        setError('Network error. Check your internet connection and try again.');
      } else {
        setError(msg || 'Failed to sign in with Google. Please try again.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsDemoLoggingIn(true);
    setError(null);
    try {
      await loginWithDemo('Dhruv');
    } catch (err: any) {
      console.error('Guest login error', err);
      setError(err.message || 'Failed to initialize session.');
    } finally {
      setIsDemoLoggingIn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto">
      {/* Dynamic Background Glow Elements */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-tertiary/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md p-8 sm:p-10 rounded-lg bg-surface-container/90 border border-white/10 shadow-card space-y-7 backdrop-blur-none text-center">
        
        {/* Brand & Animated Icon */}
        <div className="space-y-3 flex flex-col items-center">
          <div className="relative w-18 h-18 rounded-lg bg-gradient-to-tr from-primary to-primary-container flex items-center justify-center shadow-lg group">
            <Music size={34} className="text-on-primary group-hover:scale-110 transition-transform" />
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-tertiary"></span>
            </span>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
              Gaana Bajao
            </h1>
            <p className="text-xs text-on-surface-variant font-medium">
              Hyperscale Cloud Streaming & Acoustic Discovery
            </p>
          </div>
        </div>

        {/* Feature Highlights Pills */}
        <div className="grid grid-cols-2 gap-2 text-left text-xs text-on-surface-variant font-medium">
          <div className="p-2.5 rounded-lg bg-surface-container-high/60 border border-white/5 flex items-center gap-2">
            <Zap size={15} className="text-primary flex-shrink-0" />
            <span>AI Acoustic Match</span>
          </div>
          <div className="p-2.5 rounded-lg bg-surface-container-high/60 border border-white/5 flex items-center gap-2">
            <Radio size={15} className="text-tertiary flex-shrink-0" />
            <span>Multi-Device Sync</span>
          </div>
          <div className="p-2.5 rounded-lg bg-surface-container-high/60 border border-white/5 flex items-center gap-2">
            <Flame size={15} className="text-amber-400 flex-shrink-0" />
            <span>Dynamic Mixes</span>
          </div>
          <div className="p-2.5 rounded-lg bg-surface-container-high/60 border border-white/5 flex items-center gap-2">
            <ShieldCheck size={15} className="text-emerald-400 flex-shrink-0" />
            <span>Stay Signed In</span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-lg bg-error/15 border border-error/30 text-error text-xs flex flex-col gap-1.5 text-left animate-in fade-in">
            <div className="flex items-center gap-2 font-bold">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>Authentication Notice</span>
            </div>
            <p className="text-[11px] leading-relaxed text-error/90 pl-6">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Google Sign-in Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoggingIn || isDemoLoggingIn}
            className="w-full py-3.5 px-6 rounded-lg bg-white hover:bg-white/90 text-black font-extrabold text-xs sm:text-sm flex items-center justify-center gap-3 shadow-xl hover:shadow-card transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            {isLoggingIn ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Continue with Google</span>
                <ArrowRight size={15} className="text-black/60 ml-auto" />
              </>
            )}
          </button>

          {/* Continue as Guest Button */}
          <button
            onClick={handleDemoLogin}
            disabled={isLoggingIn || isDemoLoggingIn}
            className="w-full py-3 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/10 transition-all hover:scale-[1.01] cursor-pointer"
          >
            {isDemoLoggingIn ? (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <User size={14} className="text-primary" />
                <span>Continue as Guest (30-Day Session)</span>
              </>
            )}
          </button>

          {/* The previous copy here read "stored in a secure 30-day browser
              cookie". The cookie is not Secure, not HttpOnly and not signed, so
              that sentence described a protection the app does not provide.
              It now says what actually happens. */}
          <p className="text-[11px] text-on-surface-variant font-medium pt-1 leading-relaxed">
            Signing in with Google keeps you signed in for 30 days; your account is
            verified with Google every time the app loads. Guest sessions stay on
            this device only and are not backed up.
          </p>
        </div>

      </div>
    </div>
  );
};
