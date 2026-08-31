import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Music, Home, ArrowLeft } from 'lucide-react';

interface NotFoundViewProps {
  message?: string;
  title?: string;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({
  title = 'Page not found',
  message = "We couldn't find the page, playlist, or artist you're looking for."
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 min-h-[60vh] flex flex-col items-center justify-center text-center p-8 space-y-6">
      <div className="w-20 h-20 rounded-2xl bg-surface-container flex items-center justify-center shadow-card">
        <Music size={40} className="text-on-surface-variant opacity-60" />
      </div>

      <div className="space-y-2 max-w-md">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {title}
        </h1>
        <p className="text-sm text-on-surface-variant leading-relaxed">
          {message}
        </p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => navigate(-1)}
          className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-2 transition-all"
        >
          <ArrowLeft size={16} />
          <span>Go back</span>
        </button>

        <button
          onClick={() => navigate('/')}
          className="px-6 py-2.5 rounded-full bg-primary hover:bg-primary-fixed text-on-primary font-bold text-xs flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all"
        >
          <Home size={16} />
          <span>Go to Home</span>
        </button>
      </div>
    </div>
  );
};
