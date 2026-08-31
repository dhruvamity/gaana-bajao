import React, { useRef, useState, useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
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
import { TrackRouteHandler } from './components/TrackRouteHandler';
import { NotFoundView } from './components/NotFoundView';
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

const MainAppContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { currentUser, isAuthenticated, isLoading, isUserModalOpen, setIsUserModalOpen } = useAuth();
  const { currentTrack } = useAudio();

  // Owned here so the navbar search box and the search view share one query.
  const [searchQuery, setSearchQuery] = useState<string>('');

  // The content column scrolls independently, and the top bar sitting inside it
  // needs to know when to stop being transparent.
  const mainRef = useRef<HTMLElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  // Scroll to top on route change
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    setIsScrolled(false);
  }, [location.pathname]);

  // Derive active view and selected item from react-router location
  const currentView = (() => {
    if (location.pathname === '/') return 'home';
    if (location.pathname === '/search') return 'search';
    if (location.pathname === '/playlists') return 'playlists';
    if (location.pathname === '/liked' || location.pathname.startsWith('/playlist/')) return 'playlist';
    if (location.pathname.startsWith('/artist/')) return 'artist';
    return '';
  })();

  const selectedPlaylistId = location.pathname.startsWith('/playlist/')
    ? location.pathname.replace('/playlist/', '')
    : location.pathname === '/liked'
    ? 'pl-liked-collection'
    : undefined;

  const selectedArtistId = location.pathname.startsWith('/artist/')
    ? location.pathname.replace('/artist/', '')
    : undefined;

  // Sidebar Layout State
  const [isLibraryCollapsed, setIsLibraryCollapsed] = useState<boolean>(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(true);

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState<boolean>(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [addToPlaylistTrack, setAddToPlaylistTrack] = useState<Track | null>(null);

  const handleNavigate = (viewOrPath: string) => {
    if (viewOrPath === 'home' || viewOrPath === '/') navigate('/');
    else if (viewOrPath === 'search' || viewOrPath === '/search') navigate('/search');
    else if (viewOrPath === 'playlists' || viewOrPath === '/playlists') navigate('/playlists');
    else if (viewOrPath === 'liked' || viewOrPath === '/liked') navigate('/liked');
    else if (viewOrPath.startsWith('/')) navigate(viewOrPath);
    else navigate(`/${viewOrPath}`);
  };

  const handleSelectArtist = (artistId: string) => {
    navigate(`/artist/${artistId}`);
  };

  const handleSelectPlaylist = (playlist: Playlist) => {
    navigate(`/playlist/${playlist.id}`, { state: { playlist } });
  };

  const handleSelectLikedSongs = () => {
    navigate('/liked');
  };

  const handleOpenAddToPlaylist = (track: Track) => {
    setAddToPlaylistTrack(track);
  };

  const handlePlaylistCreated = (newPlaylist: Playlist) => {
    handleSelectPlaylist(newPlaylist);
  };

  const canGoBack = location.key !== 'default' || (typeof window !== 'undefined' && window.history.length > 1);

  // Loading Screen while verifying 30-day session
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
            selectedPlaylistId={selectedPlaylistId}
            selectedArtistId={selectedArtistId}
            onNavigate={handleNavigate}
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
            canGoBack={canGoBack}
            onBack={() => navigate(-1)}
          />

          <Routes>
            <Route
              path="/"
              element={
                <HomeView
                  onSelectArtist={handleSelectArtist}
                  onSelectPlaylist={handleSelectPlaylist}
                  onOpenAddToPlaylist={handleOpenAddToPlaylist}
                  onSelectLikedSongs={handleSelectLikedSongs}
                  onOpenUpload={() => setIsUploadOpen(true)}
                  onSeeAllPlaylists={() => navigate('/playlists')}
                  onOpenEditPlaylist={(pl) => setEditingPlaylist(pl)}
                />
              }
            />
            <Route
              path="/search"
              element={
                <Suspense fallback={<ViewFallback />}>
                  <SearchExploreView
                    query={searchQuery}
                    onQueryChange={setSearchQuery}
                    onSelectArtist={handleSelectArtist}
                    onOpenAddToPlaylist={handleOpenAddToPlaylist}
                  />
                </Suspense>
              }
            />
            <Route
              path="/playlists"
              element={
                <Suspense fallback={<ViewFallback />}>
                  <PlaylistsDirectoryView
                    onSelectPlaylist={handleSelectPlaylist}
                    onOpenCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
                    onOpenEditPlaylist={(pl) => setEditingPlaylist(pl)}
                  />
                </Suspense>
              }
            />
            <Route
              path="/playlist/:playlistId"
              element={
                <Suspense fallback={<ViewFallback />}>
                  <PlaylistView
                    onBack={() => navigate(-1)}
                    onSelectArtist={handleSelectArtist}
                    onOpenAddToPlaylist={handleOpenAddToPlaylist}
                    onOpenEditPlaylist={(pl) => setEditingPlaylist(pl)}
                  />
                </Suspense>
              }
            />
            <Route
              path="/liked"
              element={
                <Suspense fallback={<ViewFallback />}>
                  <PlaylistView
                    isLikedView={true}
                    onBack={() => navigate(-1)}
                    onSelectArtist={handleSelectArtist}
                    onOpenAddToPlaylist={handleOpenAddToPlaylist}
                    onOpenEditPlaylist={(pl) => setEditingPlaylist(pl)}
                  />
                </Suspense>
              }
            />
            <Route
              path="/artist/:artistId"
              element={
                <Suspense fallback={<ViewFallback />}>
                  <ArtistView
                    onBack={() => navigate(-1)}
                    onOpenAddToPlaylist={handleOpenAddToPlaylist}
                  />
                </Suspense>
              }
            />
            <Route
              path="/track/:trackId"
              element={<TrackRouteHandler />}
            />
            <Route
              path="*"
              element={<NotFoundView />}
            />
          </Routes>
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
      <MobileTabBar currentView={currentView} onNavigate={handleNavigate} />

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
          setEditingPlaylist(null);
        }}
        onPlaylistDeleted={(deletedId) => {
          setEditingPlaylist(null);
          if (location.pathname === `/playlist/${deletedId}`) {
            navigate('/');
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
      <BrowserRouter>
        <AuthProvider>
          <AudioProvider>
            <MainAppContent />
          </AudioProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
