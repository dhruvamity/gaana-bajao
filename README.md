# 🎵 Gaana-Bajao

**Gaana-Bajao** is a Spotify-inspired hyperscale cloud music streaming and acoustic discovery platform with glassmorphic UI aesthetics, 30-day cookie-based authentication, bulk audio uploading via Cloudinary, real-time multi-device playback synchronization, and collaborative playlists.

---

## 🌟 Key Features

- **Spotify-Grade Audio Player**: High-fidelity Web Audio API engine with real-time frequency visualizer, track progress seeking, shuffle, and repeat modes.
- **Bulk Music Upload**: Drag-and-drop multi-file audio uploader (`.mp3`, `.wav`, `.m4a`, `.flac`, `.ogg`) directly to Cloudinary with automatic Web Audio acoustic feature extraction (tempo, energy, valence, danceability).
- **Direct Playlist Attachment**: Attach tracks to existing playlists or create new playlists directly during the bulk upload flow.
- **Persistent 30-Day Sessions**: Secure 30-day browser cookie session management with Google OAuth and Guest login options.
- **Collaborative Playlists**: Real-time playlist creation, track management, and collaboration.
- **Dynamic Catalog Architecture**: 100% user-driven catalog with dynamic genre tags, artist discovery, and search.
- **Multi-Device Connect Sync**: Real-time playback status sync across active devices and browser sessions.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, Glassmorphic Design System, Lucide Icons
- **Audio Processing**: Web Audio API (AnalyserNode, AudioContext)
- **Authentication & Database**: Firebase Authentication, Cloud Firestore
- **Media Storage**: Cloudinary REST API (Unsigned Presets)

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- npm or yarn

### 2. Installation
```bash
git clone https://github.com/dhruvamity/gaana-bajao.git
cd gaana-bajao
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory following `.env.example`:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Cloudinary Configuration
VITE_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_upload_preset
```

### 4. Run Development Server
```bash
npm run dev
```

### 5. Build for Production
```bash
npm run build
```

---

## 📄 License
MIT License
