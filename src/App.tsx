import React, { useRef, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AudioProvider, useAudio } from './context/AudioContext';
import { Navbar } from './components/Navbar';
import { LibrarySidebar } from './components/LibrarySidebar';
import { NowPlayingSidebar } from './components/NowPlayingSidebar';
import { HomeView } from './components/HomeView';
import { SearchExploreView } from './components/SearchExploreView';
import { PlaylistsDirectoryView } from './components/PlaylistsDirectoryView';
import { PlaylistView } from './components/PlaylistView';
import { ArtistView } from './components/ArtistView';
import { MiniPlayer } from './components/MiniPlayer';
import { NowPlayingModal } from './components/NowPlayingModal';
import { ConnectMenu } from './components/ConnectMenu';
import { TasteOnboarding } from './components/TasteOnboarding';
import { QueueDrawer } from './components/QueueDrawer';
import { UploadModal } from './components/UploadModal';
import { SettingsModal } from './components/SettingsModal';
import { CreatePlaylistModal } from './components/CreatePlaylistModal';
import { AddToPlaylistModal } from './components/AddToPlaylistModal';
import { UserManagementModal } from './components/UserManagementModal';
import { AuthModal } from './components/AuthModal';
import { Playlist, Track } from './types';
import { Music } from 'lucide-react';

/** A snapshot of everything that decides what the content column renders. */
interface ViewState {
  view: string;
  artistId: string | null;
  playlist: Playlist | null;
}

const MainAppContent: React.FC = () => {
  const { currentUser, isAuthenticated, isLoading, isUserModalOpen, setIsUserModalOpen } = useAuth();
  const { currentTrack } = useAudio();

  const [currentView, setCurrentView] = useState<string>('home');
  // Owned here so the navbar search box and the search view share one query.
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

  // The content column scrolls independently, and the top bar sitting inside it
  // needs to know when to stop being transparent.
  const mainRef = useRef<HTMLElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  /* The comp's header has a back arrow, which needs somewhere to go. The app
     has no router, so navigation keeps its own stack of view snapshots. */
  const [history, setHistory] = useState<ViewState[]>([]);

  const pushHistory = () => {
    setHistory(h => [
      ...h.slice(-19),
      { view: currentView, artistId: selectedArtistId, playlist: selectedPlaylist }
    ]);
  };

  const applyView = (state: ViewState) => {
    setCurrentView(state.view);
    setSelectedArtistId(state.artistId);
    setSelectedPlaylist(state.playlist);
    mainRef.current?.scrollTo({ top: 0 });
    setIsScrolled(false);
  };

  const navigate = (view: string) => {
    if (view === currentView) return;
    pushHistory();
    setCurrentView(view);
    mainRef.current?.scrollTo({ top: 0 });
    setIsScrolled(false);
  };

  const goBack = () => {
    if (history.length === 0) return;
    // Read the entry outside the updater: StrictMode double-invokes updaters,
    // and applyView is a side effect that must run exactly once.
    const previous = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    applyView(previous);
  };

  // Sidebar Layout State
  const [isLibraryCollapsed, setIsLibraryCollapsed] = useState<boolean>(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(true);

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState<boolean>(false);
  const [addToPlaylistTrack, setAddToPlaylistTrack] = useState<Track | null>(null);

  const handleSelectArtist = (artistId: string) => {
    pushHistory();
    setSelectedArtistId(artistId);
    setCurrentView('artist');
    mainRef.current?.scrollTo({ top: 0 });
    setIsScrolled(false);
  };

  const handleSelectPlaylist = (playlist: Playlist) => {
    pushHistory();
    setSelectedPlaylist(playlist);
    setCurrentView('playlist');
    mainRef.current?.scrollTo({ top: 0 });
    setIsScrolled(false);
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
            />
          )}

          {currentView === 'search' && (
            <SearchExploreView
              query={searchQuery}
              onQueryChange={setSearchQuery}
              onSelectArtist={handleSelectArtist}
              onOpenAddToPlaylist={handleOpenAddToPlaylist}
            />
          )}

          {currentView === 'playlists' && (
            <PlaylistsDirectoryView
              onSelectPlaylist={handleSelectPlaylist}
              onOpenCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
            />
          )}

          {currentView === 'artist' && selectedArtistId && (
            <ArtistView
              artistId={selectedArtistId}
              onBack={goBack}
              onOpenAddToPlaylist={handleOpenAddToPlaylist}
            />
          )}

          {currentView === 'playlist' && selectedPlaylist && (
            <PlaylistView
              playlist={selectedPlaylist}
              onBack={goBack}
              onSelectArtist={handleSelectArtist}
              onOpenAddToPlaylist={handleOpenAddToPlaylist}
            />
          )}
        </main>

        {/* Right: Now Playing Side Panel (Collapsible) */}
        {isRightSidebarOpen && currentTrack && (
          <div className="hidden lg:block h-full min-h-0 animate-in fade-in slide-in-from-right-4">
            <NowPlayingSidebar
              onClose={() => setIsRightSidebarOpen(false)}
              onSelectArtist={handleSelectArtist}
              onOpenAddToPlaylist={handleOpenAddToPlaylist}
            />
          </div>
        )}
      </div>

      {/* 3. Persistent Full-Width Bottom Player Bar */}
      <MiniPlayer 
        onSelectArtist={handleSelectArtist}
        onOpenAddToPlaylist={handleOpenAddToPlaylist}
        isRightSidebarOpen={isRightSidebarOpen}
        onToggleRightSidebar={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
      />

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
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onTrackUploaded={(newTrack) => {
          console.log('Track cataloged:', newTrack.title);
        }}
        onPlaylistCreated={handlePlaylistCreated}
      />

      {/* Create Playlist Modal */}
      <CreatePlaylistModal
        isOpen={isCreatePlaylistOpen}
        onClose={() => setIsCreatePlaylistOpen(false)}
        onPlaylistCreated={handlePlaylistCreated}
        initialTrackId={addToPlaylistTrack?.id}
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
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Listener Profile & Account Modal */}
      <UserManagementModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
      />
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AudioProvider>
        <MainAppContent />
      </AudioProvider>
    </AuthProvider>
  );
}

export default App;
