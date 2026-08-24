import React, { useState } from 'react';
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

const MainAppContent: React.FC = () => {
  const { currentUser, isAuthenticated, isLoading, isUserModalOpen, setIsUserModalOpen } = useAuth();
  const { currentTrack } = useAudio();

  const [currentView, setCurrentView] = useState<string>('home');
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

  // Sidebar Layout State
  const [isLibraryCollapsed, setIsLibraryCollapsed] = useState<boolean>(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(true);

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState<boolean>(false);
  const [addToPlaylistTrack, setAddToPlaylistTrack] = useState<Track | null>(null);

  const handleSelectArtist = (artistId: string) => {
    setSelectedArtistId(artistId);
    setCurrentView('artist');
  };

  const handleSelectPlaylist = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setCurrentView('playlist');
  };

  const handleSelectLikedSongs = () => {
    if (!currentUser) return;
    const likedPlaylist: Playlist = {
      id: 'pl-liked-collection',
      title: 'Liked Songs',
      description: `Your personal library of saved favorites (${currentUser.likedTrackIds?.length || 0} tracks)`,
      coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80',
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
    setSelectedPlaylist(newPlaylist);
    setCurrentView('playlist');
  };

  // Loading Screen while verifying 30-day cookie
  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-background flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-primary-container flex items-center justify-center animate-pulse shadow-xl shadow-primary/30">
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
    <div className="h-screen w-screen bg-background text-on-background flex flex-col font-body antialiased selection:bg-primary/20 selection:text-primary overflow-hidden">
      {/* 1. Top Integrated Navigation Bar */}
      <Navbar
        currentView={currentView}
        setCurrentView={(view) => {
          setCurrentView(view);
        }}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* 2. Three-Column Main Desktop Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Your Library Sidebar */}
        <div className="hidden md:block h-full">
          <LibrarySidebar
            currentView={currentView}
            selectedPlaylistId={selectedPlaylist?.id}
            selectedArtistId={selectedArtistId || undefined}
            onSelectPlaylist={handleSelectPlaylist}
            onSelectArtist={handleSelectArtist}
            onSelectLikedSongs={handleSelectLikedSongs}
            onOpenCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
            isCollapsed={isLibraryCollapsed}
            onToggleCollapse={() => setIsLibraryCollapsed(!isLibraryCollapsed)}
          />
        </div>

        {/* Center: Main Scrollable Content Pane */}
        <main className="flex-1 h-full overflow-y-auto bg-gradient-to-b from-surface-container-lowest/40 to-background scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
          {currentView === 'home' && (
            <HomeView
              onSelectArtist={handleSelectArtist}
              onSelectPlaylist={handleSelectPlaylist}
              onOpenAddToPlaylist={handleOpenAddToPlaylist}
              onSelectLikedSongs={handleSelectLikedSongs}
              onOpenUpload={() => setIsUploadOpen(true)}
            />
          )}

          {currentView === 'search' && (
            <SearchExploreView 
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
              onBack={() => setCurrentView('home')}
              onOpenAddToPlaylist={handleOpenAddToPlaylist}
            />
          )}

          {currentView === 'playlist' && selectedPlaylist && (
            <PlaylistView
              playlist={selectedPlaylist}
              onBack={() => setCurrentView('home')}
              onSelectArtist={handleSelectArtist}
              onOpenAddToPlaylist={handleOpenAddToPlaylist}
            />
          )}
        </main>

        {/* Right: Now Playing Side Panel (Collapsible) */}
        {isRightSidebarOpen && currentTrack && (
          <div className="hidden lg:block h-full animate-in fade-in slide-in-from-right-4 duration-300">
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
