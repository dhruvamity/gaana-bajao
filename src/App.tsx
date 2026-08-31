import React, { useRef, useState, useEffect, useCallback, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AudioProvider, useAudio } from './context/AudioContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer } from './components/Toast';
import { Navbar } from './components/Navbar';
import { LibrarySidebar } from './components/LibrarySidebar';
import { NowPlayingSidebar } from './components/NowPlayingSidebar';
import { HomeView } from './components/HomeView';
import { MiniPlayer } from './components/MiniPlayer';
import { MobileMiniPlayer } from './components/MobileMiniPlayer';
import { MobileTabBar } from './components/MobileTabBar';
import { NowPlayingModal } from './components/NowPlayingModal';
import { ConnectMenu } from './components/ConnectMenu';
import { TasteOnboarding } from './components/TasteOnboarding';
import { QueueDrawer } from './components/QueueDrawer';
import { CreatePlaylistModal } from './components/CreatePlaylistModal';
import { EditPlaylistModal } from './components/EditPlaylistModal';
import { AddToPlaylistModal } from './components/AddToPlaylistModal';
import { UserManagementModal } from './components/UserManagementModal';
import { AuthModal } from './components/AuthModal';
import { Playlist, Track } from './types';
import { Music } from 'lucide-react';

// Lazy-loaded heavy views: these are only pulled when the user navigates to them,
// reducing the initial bundle from one 890kB chunk.
const SearchExploreView = React.lazy(() => import('./components/SearchExploreView').then(m => ({ default: m.SearchExploreView })));
const PlaylistsDirectoryView = React.lazy(() => import('./components/PlaylistsDirectoryView').then(m => ({ default: m.PlaylistsDirectoryView })));
const PlaylistView = React.lazy(() => import('./components/PlaylistView').then(m => ({ default: m.PlaylistView })));
const ArtistView = React.lazy(() => import('./components/ArtistView').then(m => ({ default: m.ArtistView })));
const UploadModal = React.lazy(() => import('./components/UploadModal').then(m => ({ default: m.UploadModal })));
const SettingsModal = React.lazy(() => import('./components/SettingsModal').then(m => ({ default: m.SettingsModal })));

/** Minimal fallback for Suspense while a lazy chunk loads. */
const ViewFallback = () => (
  <div className="flex-1 flex items-center justify-center p-12">
    <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center animate-pulse">
      <Music size={20} className="text-on-surface-variant" />
    </div>
  </div>
);

/** A snapshot of everything that decides what the content column renders. */
interface ViewState {
  view: string;
  artistId: string | null;
  playlist: Playlist | null;
}

/** Serialisable subset of ViewState for browser history.state. */
interface SerializedViewState {
  view: string;
  artistId: string | null;
  /** Playlists are JSON-safe objects, so they round-trip through history.state. */
  playlist: Playlist | null;
}

function serializeViewState(s: ViewState): SerializedViewState {
  return { view: s.view, artistId: s.artistId, playlist: s.playlist };
}

const MainAppContent: React.FC = () => {
  const { currentUser, isAuthenticated, isLoading, isUserModalOpen, setIsUserModalOpen } = useAuth();
  const { currentTrack } = useAudio();

  // Restore the view from browser history.state on mount (hard refresh).
  const initial = (typeof window !== 'undefined' && window.history.state) as SerializedViewState | null;

  const [currentView, setCurrentView] = useState<string>(initial?.view || 'home');
  // Owned here so the navbar search box and the search view share one query.
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(initial?.artistId || null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(initial?.playlist || null);

  // The content column scrolls independently, and the top bar sitting inside it
  // needs to know when to stop being transparent.
  const mainRef = useRef<HTMLElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  /* The comp's header has a back arrow, which needs somewhere to go. The app
     has no router, so navigation keeps its own stack of view snapshots. */
  const [history, setHistory] = useState<ViewState[]>([]);

  /** True while our own goBack() is driving a history.back() — suppresses the
   *  popstate handler so the view isn't applied twice. */
  const isInternalPop = useRef(false);

  const pushHistory = () => {
    setHistory(h => [
      ...h.slice(-19),
      { view: currentView, artistId: selectedArtistId, playlist: selectedPlaylist }
    ]);
  };

  const applyView = useCallback((state: ViewState) => {
    setCurrentView(state.view);
    setSelectedArtistId(state.artistId);
    setSelectedPlaylist(state.playlist);
    mainRef.current?.scrollTo({ top: 0 });
    setIsScrolled(false);
  }, []);

  const navigate = (view: string) => {
    if (view === currentView) return;
    pushHistory();
    setCurrentView(view);
    mainRef.current?.scrollTo({ top: 0 });
    setIsScrolled(false);
    // Push a browser history entry so Back/Forward work.
    window.history.pushState(
      serializeViewState({ view, artistId: selectedArtistId, playlist: selectedPlaylist }),
      ''
    );
  };

  const goBack = () => {
    if (history.length === 0) return;
    // Read the entry outside the updater: StrictMode double-invokes updaters,
    // and applyView is a side effect that must run exactly once.
    const previous = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    applyView(previous);
    // Also step the browser history back so the URL bar stays in sync.
    isInternalPop.current = true;
    window.history.back();
  };

  // Handle browser Back/Forward buttons via popstate.
  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      // If our own goBack() triggered this, the view is already applied.
      if (isInternalPop.current) {
        isInternalPop.current = false;
        return;
      }
      const state = e.state as SerializedViewState | null;
      if (state) {
        applyView(state);
      } else {
        // No state — treat as home (initial entry).
        applyView({ view: 'home', artistId: null, playlist: null });
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [applyView]);

  // Sidebar Layout State
  const [isLibraryCollapsed, setIsLibraryCollapsed] = useState<boolean>(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(true);

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState<boolean>(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [addToPlaylistTrack, setAddToPlaylistTrack] = useState<Track | null>(null);

  const handleSelectArtist = (artistId: string) => {
    pushHistory();
    setSelectedArtistId(artistId);
    setCurrentView('artist');
    mainRef.current?.scrollTo({ top: 0 });
    setIsScrolled(false);
    window.history.pushState(
      serializeViewState({ view: 'artist', artistId, playlist: selectedPlaylist }),
      ''
    );
  };

  const handleSelectPlaylist = (playlist: Playlist) => {
    pushHistory();
    setSelectedPlaylist(playlist);
    setCurrentView('playlist');
    mainRef.current?.scrollTo({ top: 0 });
    setIsScrolled(false);
    window.history.pushState(
      serializeViewState({ view: 'playlist', artistId: selectedArtistId, playlist }),
      ''
    );
  };

  const handleSelectLikedSongs = () => {
    if (!currentUser) return;
    pushHistory();
    const likedPlaylist: Playlist = {
      id: 'pl-liked-collection',
      title: 'Liked Songs',
      description: `Your personal library of saved favorites (${currentUser.likedTrackIds?.length || 0} tracks)`,
      coverUrl: '',
      trackIds: currentUser.likedTrackIds || [],
      ownerId: currentUser.id,
      ownerName: currentUser.name,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setSelectedPlaylist(likedPlaylist);
    setCurrentView('playlist');
    window.history.pushState(
      serializeViewState({ view: 'playlist', artistId: selectedArtistId, playlist: likedPlaylist }),
      ''
    );
  };

  const handleOpenAddToPlaylist = (track: Track) => {
    setAddToPlaylistTrack(track);
  };

  const handlePlaylistCreated = (newPlaylist: Playlist) => {
    handleSelectPlaylist(newPlaylist);
  };

  // Loading Screen while verifying 30-day cookie
  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-background flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 rounded-lg bg-gradient-to-tr from-primary to-primary-container flex items-center justify-center animate-pulse shadow-xl ">
          <Music size={32} className="text-on-primary animate-spin" />
        </div>
        <p className="text-xs text-on-surface-variant font-bold tracking-widest uppercase">
          Initializing Session...
        </p>
      </div>
    );
  }

  // Google Login Gate if not authenticated
  if (!isAuthenticated || !currentUser) {
    return <AuthModal />;
  }

  return (
    /* The shell is three flush, full-height columns — navigation, content and
       the right panel — with the player bar spanning beneath them. Nothing
       floats and nothing is rounded; the columns are separated only by a
       change of fill, and the top bar lives *inside* the content column so the
       page's hero wash can run up behind it. */
    <div className="h-screen w-screen bg-background text-on-background flex flex-col font-body antialiased overflow-hidden">
      {/* Skip link for keyboard users — jumps over potentially hundreds of
          media card tab stops straight to the player transport. */}
      <a
        href="#player-controls"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary focus:text-on-primary focus:rounded-lg focus:text-sm focus:font-bold"
      >
        Skip to player controls
      </a>
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        {/* Left: navigation + library */}
        <div className="hidden md:block h-full min-h-0">
          <LibrarySidebar
            currentView={currentView}
            selectedPlaylistId={selectedPlaylist?.id}
            selectedArtistId={selectedArtistId || undefined}
            onNavigate={navigate}
            onSelectPlaylist={handleSelectPlaylist}
            onSelectArtist={handleSelectArtist}
            onSelectLikedSongs={handleSelectLikedSongs}
            onOpenCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
            onOpenEditPlaylist={(pl) => setEditingPlaylist(pl)}
            isCollapsed={isLibraryCollapsed}
            onToggleCollapse={() => setIsLibraryCollapsed(!isLibraryCollapsed)}
          />
        </div>

        {/* Center: the scrolling content column, with its own top bar */}
        <main
          ref={mainRef}
          onScroll={(e) => setIsScrolled(e.currentTarget.scrollTop > 8)}
          className="flex-1 h-full min-w-0 overflow-y-auto app-panel bg-surface-container-lowest"
        >
          <Navbar
            currentView={currentView}
            onOpenUpload={() => setIsUploadOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            isScrolled={isScrolled}
            canGoBack={history.length > 0}
            onBack={goBack}
          />

          {currentView === 'home' && (
            <HomeView
              onSelectArtist={handleSelectArtist}
              onSelectPlaylist={handleSelectPlaylist}
              onOpenAddToPlaylist={handleOpenAddToPlaylist}
              onSelectLikedSongs={handleSelectLikedSongs}
              onOpenUpload={() => setIsUploadOpen(true)}
              onSeeAllPlaylists={() => navigate('playlists')}
              onOpenEditPlaylist={(pl) => setEditingPlaylist(pl)}
            />
          )}

          {currentView === 'search' && (
            <Suspense fallback={<ViewFallback />}>
              <SearchExploreView
                query={searchQuery}
                onQueryChange={setSearchQuery}
                onSelectArtist={handleSelectArtist}
                onOpenAddToPlaylist={handleOpenAddToPlaylist}
              />
            </Suspense>
          )}

          {currentView === 'playlists' && (
            <Suspense fallback={<ViewFallback />}>
              <PlaylistsDirectoryView
                onSelectPlaylist={handleSelectPlaylist}
                onOpenCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
                onOpenEditPlaylist={(pl) => setEditingPlaylist(pl)}
              />
            </Suspense>
          )}

          {currentView === 'artist' && selectedArtistId && (
            <Suspense fallback={<ViewFallback />}>
              <ArtistView
                artistId={selectedArtistId}
                onBack={goBack}
                onOpenAddToPlaylist={handleOpenAddToPlaylist}
              />
            </Suspense>
          )}

          {currentView === 'playlist' && selectedPlaylist && (
            <Suspense fallback={<ViewFallback />}>
              <PlaylistView
                playlist={selectedPlaylist}
                onBack={goBack}
                onSelectArtist={handleSelectArtist}
                onOpenAddToPlaylist={handleOpenAddToPlaylist}
                onOpenEditPlaylist={(pl) => setEditingPlaylist(pl)}
              />
            </Suspense>
          )}
        </main>

        {/* Right: Now Playing Side Panel (Collapsible) */}
        {isRightSidebarOpen && currentTrack && (
          <div className="hidden xl:block h-full min-h-0 animate-in fade-in slide-in-from-right-4">
            <NowPlayingSidebar
              onClose={() => setIsRightSidebarOpen(false)}
              onSelectArtist={handleSelectArtist}
              onOpenAddToPlaylist={handleOpenAddToPlaylist}
            />
          </div>
        )}
      </div>

      {/* Bottom chrome. The desktop bar and the mobile docked card are
          different objects in the comp, so each renders at its own breakpoint
          rather than one bar trying to be both. */}
      <div id="player-controls" className="hidden md:block">
        <MiniPlayer 
        onSelectArtist={handleSelectArtist}
        onOpenAddToPlaylist={handleOpenAddToPlaylist}
        isRightSidebarOpen={isRightSidebarOpen}
        onToggleRightSidebar={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
        />
      </div>

      <MobileMiniPlayer />
      <MobileTabBar currentView={currentView} onNavigate={navigate} />

      {/* Fullscreen Player Modal */}
      <NowPlayingModal 
        onSelectArtist={handleSelectArtist}
        onOpenAddToPlaylist={handleOpenAddToPlaylist}
      />

      {/* Connect & Handoff Sheet */}
      <ConnectMenu />

      {/* Cold-Start Taste Onboarding Modal */}
      <TasteOnboarding />

      {/* Up Next Queue Drawer */}
      <QueueDrawer />

      {/* Music Upload & Audio Analysis Modal */}
      {isUploadOpen && (
        <Suspense fallback={<ViewFallback />}>
          <UploadModal
            isOpen={isUploadOpen}
            onClose={() => setIsUploadOpen(false)}
            onTrackUploaded={(newTrack) => {
              console.log('Track cataloged:', newTrack.title);
            }}
            onPlaylistCreated={handlePlaylistCreated}
          />
        </Suspense>
      )}

      {/* Create Playlist Modal */}
      <CreatePlaylistModal
        isOpen={isCreatePlaylistOpen}
        onClose={() => setIsCreatePlaylistOpen(false)}
        onPlaylistCreated={handlePlaylistCreated}
        initialTrackId={addToPlaylistTrack?.id}
      />

      {/* Edit Playlist Modal */}
      <EditPlaylistModal
        isOpen={Boolean(editingPlaylist)}
        onClose={() => setEditingPlaylist(null)}
        playlist={editingPlaylist}
        onPlaylistUpdated={(updated) => {
          if (selectedPlaylist?.id === updated.id) {
            setSelectedPlaylist(updated);
          }
        }}
        onPlaylistDeleted={(deletedId) => {
          if (selectedPlaylist?.id === deletedId) {
            setSelectedPlaylist(null);
            navigate('home');
          }
        }}
      />

      {/* Add To Playlist Modal */}
      <AddToPlaylistModal
        isOpen={Boolean(addToPlaylistTrack)}
        onClose={() => setAddToPlaylistTrack(null)}
        track={addToPlaylistTrack}
        onOpenCreatePlaylist={() => {
          setIsCreatePlaylistOpen(true);
        }}
      />

      {/* Settings & Firestore Config Modal */}
      {isSettingsOpen && (
        <Suspense fallback={<ViewFallback />}>
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
          />
        </Suspense>
      )}

      {/* Listener Profile & Account Modal */}
      <UserManagementModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
      />

      {/* Write Error & Sync Feedback Toast Container */}
      <ToastContainer />
    </div>
  );
};

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AudioProvider>
          <MainAppContent />
        </AudioProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
