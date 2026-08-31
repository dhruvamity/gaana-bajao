import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DatabaseService } from '../services/firebase';
import { useAudio } from '../context/AudioContext';
import { NotFoundView } from './NotFoundView';
import { Music, Loader2 } from 'lucide-react';
import { Track } from '../types';

export const TrackRouteHandler: React.FC = () => {
  const { trackId } = useParams<{ trackId: string }>();
  const navigate = useNavigate();
  const { playTrack, setIsNowPlayingOpen } = useAudio();

  const [loading, setLoading] = useState(true);
  const [track, setTrack] = useState<Track | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!trackId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let isMounted = true;

    DatabaseService.getTrackById(trackId).then((foundTrack) => {
      if (!isMounted) return;
      if (foundTrack) {
        setTrack(foundTrack);
        try {
          playTrack(foundTrack);
          setIsNowPlayingOpen(true);
        } catch (err) {
          console.warn('Track autoplay attempt handled:', err);
        }
        // Replace URL back to root so the address bar doesn't stay pinned on the launcher path
        navigate('/', { replace: true });
      } else {
        setNotFound(true);
      }
      setLoading(false);
    }).catch((err) => {
      console.error('Failed to load track from route', err);
      if (isMounted) {
        setNotFound(true);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [trackId, navigate, playTrack, setIsNowPlayingOpen]);

  if (loading) {
    return (
      <div className="flex-1 min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center animate-pulse">
          <Loader2 size={28} className="text-primary animate-spin" />
        </div>
        <p className="text-xs text-on-surface-variant font-bold tracking-widest uppercase">
          Loading Track...
        </p>
      </div>
    );
  }

  if (notFound) {
    return (
      <NotFoundView
        title="Track Not Found"
        message="The song you are looking for does not exist in the library or was removed."
      />
    );
  }

  return null;
};
