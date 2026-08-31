# Gaana-Bajao — Architecture & Field Guide

A single-page music streaming client: your own audio files in Cloudinary, catalogued in
Firestore, played back in a Spotify-shaped interface.

**There is no backend of its own.** The browser talks to Firebase and Cloudinary directly,
which is what makes `firestore.rules` the load-bearing part of the design rather than a
formality.

| | |
|---|---|
| Source | ~10,300 lines TS/TSX |
| Components | 25 |
| Services | 7 |
| State stores | 2 React contexts |
| Bundle | 872 kB raw / 222 kB gzip (single chunk) |

---

## 1. The stack

Deliberately small. There is no router, no state library, no component library and no server
of the project's own — each of those jobs is done by something below, or by a React context.

### Application
- **React 18.3** + **TypeScript 5.6**, built by **Vite 6.1**
- **Tailwind 3.4**, driven by a semantic token layer in `tailwind.config.js` so the whole app
  re-themes from one file
- `lucide-react` for icons; `clsx` + `tailwind-merge` for class composition

### Backend services
- **Firebase 11.3** supplies both halves: **Firestore** for the catalog, **Firebase Auth**
  for Google sign-in
- **Cloudinary** stores audio and cover images, via *unsigned upload presets*

### Audio & metadata
- Playback is a plain `HTMLAudioElement` (see §3 for why)
- `jsmediatags` + `music-metadata` read tags from local files
- A hand-rolled ID3v2 parser reads tags from files *already in the cloud*, over HTTP Range

### Deliberately absent
| Not used | Replaced by |
|---|---|
| React Router | A view string + history stack in `App.tsx` |
| Redux / Zustand | Two React contexts |
| Component library | Tailwind tokens + local components |
| Any server | Firestore security rules |

### Environment variables
```
VITE_FIREBASE_API_KEY           VITE_CLOUDINARY_CLOUD_NAME
VITE_FIREBASE_AUTH_DOMAIN       VITE_CLOUDINARY_UPLOAD_PRESET
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```
`.env` is gitignored. Firebase config can also be supplied at runtime through the Settings
modal, which persists it to `localStorage`.

---

## 2. Architecture

Four layers. Data flows down, events come back up. Components never touch Firestore or
Cloudinary directly — they go through a context or a service.

**The rule worth remembering:** services are static classes with no React knowledge (no hooks,
no JSX, no React imports), so they stay testable and usable outside the tree.

```
┌─ VIEWS & CHROME ──────────────────────────────────────────────────────┐
│  App.tsx (shell + history)                                            │
│  HomeView · PlaylistView · ArtistView · SearchExploreView              │
│  MediaCard · SectionHeader · CoverArt · Scrubber                      │
│  MiniPlayer · MobileMiniPlayer · MobileTabBar · NowPlayingModal        │
│  UploadModal · LibraryRepairPanel · + 11 more                         │
└───────────────────────────────┬───────────────────────────────────────┘
                                ↓  props / context hooks
┌─ REACT CONTEXTS ──────────────────────────────────────────────────────┐
│  AudioContext  — playback, queue, shuffle/repeat, telemetry           │
│  AuthContext   — identity, session, taste profile, likes              │
│                  (the only mutable app state; everything else is      │
│                   derived or fetched)                                 │
└───────────────────────────────┬───────────────────────────────────────┘
                                ↓  static calls
┌─ SERVICES ────────────────────────────────────────────────────────────┐
│  firebase.ts             687 ln   all reads and writes                │
│  audioEngine.ts          405 ln   playback element + analyser         │
│  libraryRepair.ts        326 ln   re-read tags from stored files      │
│  recommendationEngine.ts 274 ln   ranking + home shelves              │
│  metadataService.ts      252 ln   ID3 parsing, local and remote       │
│  storageService.ts                Cloudinary uploads                  │
│  connectSync.ts                   device identity + state broadcast   │
└───────────────────────────────┬───────────────────────────────────────┘
                                ↓  network
┌─ EXTERNAL ────────────────────────────────────────────────────────────┐
│  Firestore · Firebase Auth · Cloudinary · localStorage (offline cache)│
└───────────────────────────────────────────────────────────────────────┘
```

### The audio engine is the one piece of real engineering here

`src/services/audioEngine.ts` plays through a **bare media element with no Web Audio graph**.
That is a deliberate, hard-won choice:

- Routing a cross-origin Cloudinary stream through `MediaElementAudioSourceNode` **silences it
  outright** — in every variant tested.
- Setting `crossOrigin` on the element makes it worse: if the host omits
  `Access-Control-Allow-Origin`, the element refuses to load the resource at all and fails with
  `MEDIA_ELEMENT_ERROR code 4`.
- The analyser is therefore **opt-in and self-verifying**: `enableAnalyser()` builds the graph,
  confirms real signal is arriving within 800 ms, and if not, marks the analyser unavailable and
  rebuilds the element at the same playback position.
- That check is timer-based, not `requestAnimationFrame` — rAF never fires in a hidden tab,
  which would leave the promise pending forever.

---

## 3. Data model

The catalog is communal; everything about a person is not. Six collections, then a catch-all
that denies anything unlisted — so adding a collection without a rule **fails closed**.

| Collection | Read | Write | Holds |
|---|---|---|---|
| `tracks/{id}` | all signed in | uploader only, via `ownerId` | title, artist, album, audio URL, artwork, acoustics, play counts |
| `playlists/{id}` | all signed in | owner, or a uid in `collaboratorIds` | track ids, cover, collaborators |
| `publicProfiles/{uid}` | all signed in | self only, **shape-pinned** | display name + avatar, nothing else |
| `users/{uid}` | **self only** | self only | email, liked tracks, taste vector, optional PIN, onboarding state |
| `users/{uid}/devices/{id}` | **self only** | self only | active playback sessions for handoff |
| `telemetry/{id}` | **own events only** | append-only, own uid | skips, completions, likes — the ranking signal |

`publicProfiles` exists specifically so a collaborator picker never needs access to `users`.
Its write rule uses `hasOnly(['name','avatar'])`, so a client cannot smuggle an email or a
taste vector into a world-readable document.

> ⚠️ **These rules are written but not deployed.** Until
> `firebase deploy --only firestore:rules` runs, the database is in whatever state the console
> left it and none of the above is enforced.
>
> **Run Library Repair with "Claim ownership" ticked _before_ deploying.** Tracks uploaded
> before `ownerId` existed have no owner, and the new rules will refuse to let anyone edit them.

---

## 4. How it works

### 4.1 Signing in

1. Two doors: **Google** through Firebase Auth (popup, falling back to redirect when blocked),
   or **Guest**, which mints a local `user_guest_*` profile with no server identity at all.
2. A 30-day cookie stores uid, display name and avatar so the shell paints the right identity
   on the first frame instead of flashing the sign-in screen.
3. That cookie is a **hint, not a credential** — it is unsigned and script-readable, and
   nothing in a client bundle can change that. Firebase Auth is authoritative: a null auth
   state clears any session claiming a Firebase identity, and such a session is refused
   outright when Auth is not configured (the confirmation could never arrive).
4. Guests are exempt from that check — they never had a Firebase identity to lose, and rules
   keyed on `request.auth.uid` deny them server-side regardless of what the cookie says.

### 4.2 Getting music in

1. Drop files into the upload modal. Each is read locally: `extractAudioMetadata` pulls ID3
   tags and embedded cover art; `AudioEngine.getAudioDurationAndAcoustics` derives duration
   plus tempo, energy and valence.
2. Audio and artwork upload to Cloudinary as unsigned blobs; only the resulting URLs are kept.
3. A `Track` document is written to Firestore with `ownerId` set at creation — it can never be
   reassigned.
4. If artwork was missed at upload, **Library Repair** (`libraryRepair.ts`) re-reads tags from
   the stored files using bounded HTTP Range requests, and classifies each result so
   *"no artwork in the file"* is distinguishable from *"could not read the file"*:

   | Diagnosis | Meaning |
   |---|---|
   | `artwork-available` | file has embedded art not yet in the catalog — repairable |
   | `tags-no-artwork` | tag container present, no picture frame — nothing to recover |
   | `stripped-on-host` | valid audio, no ID3 tag at all — re-upload the tagged original |
   | `unreadable` | fetch or parse failed — usually CORS or an expired URL |
   | `already-correct` | catalog already matches the file |

### 4.3 Playing something

1. A click reaches `playTrack` on `AudioContext`, which sets the queue and hands the URL to
   the engine.
2. The engine is created **once** for the app's lifetime. Its effect has an empty dependency
   array and callbacks route through a ref. An earlier version depended on
   `[currentTrack, duration]`, so it tore down and rebuilt the engine on every track change —
   aborting playback on the very track it was trying to start.
3. Interactions are recorded as they happen: 30 s played, completed, skipped early, liked.
   Skip classification goes through `RecommendationEngine.evaluatePlaybackDuration`, so the
   threshold is defined in one place.
4. Playback position broadcasts every **15 seconds** for cross-device handoff — not on every
   frame, which previously cost ~80 Firestore writes per 20 seconds.

### 4.4 What lands on the home page

1. The greeting reads time of day; below it, shortcut tiles for liked songs and recent playlists.
2. `RecommendationEngine.generateHomeShelves` consumes the catalog, the profile and the
   telemetry log, returning typed shelves — contextual, discovery, release radar, jump-back-in.
3. Ranking combines acoustic affinity with a friction-weighted interaction score, a fatigue
   penalty for over-played tracks, and **15% random exploration** so shelves do not calcify.
4. Each card's subtitle carries the engine's own stated reason, so a recommendation is legible
   rather than opaque.

---

## 5. The interface

Rebuilt against the Spotify Figma community kits (desktop + mobile). Two breakpoints, two
genuinely different layouts rather than one squeezed into the other. The divide is `md`.

### Desktop
Three flush, full-height columns — a **310px** black navigation column, the scrolling content
column, a **346px** right panel — with a **112px** player bar spanning beneath. Nothing floats
and nothing is rounded; columns are separated only by a change of fill.

The top bar lives *inside* the content column, transparent until you scroll, so each page's
hero wash runs up behind it.

### Mobile
A three-tab bar, and a **59px** player card docked above it that tints itself from the current
artwork. Tapping it opens the full-screen player: large artwork, remaining time counting down,
67px transport button.

### Cross-cutting
- **Artwork always resolves.** Real embedded cover art when a file has it; otherwise a cover
  generated deterministically from the track's own identity, so items stay visually distinct
  instead of collapsing into one placeholder. Same fallback catches expired Cloudinary links.
- **Accessibility.** Scrub bars are real `role="slider"` controls with drag, arrow keys and
  announced values. Focus is visible globally. Pinch-zoom is no longer blocked
  (WCAG 1.4.4). Motion respects `prefers-reduced-motion`.

> ⚠️ **The sharpest usability gap is the missing router.** Views are a string in `App.tsx`, so
> nothing is linkable, the browser's own back button leaves the app rather than going back a
> view, and a refresh always returns you to Home. The in-app back arrow works because
> navigation keeps its own stack — but that stack is lost on reload.

---

## 6. Health

From the 74-finding audit.

### Recently closed

| | Finding | What it was |
|---|---|---|
| ✅ | **B2** Profile disclosure | The collaborator picker ran `getDocs(collection(db,'users'))`, pulling every user document into every browser — emails, listening history, taste vectors, optional PINs — and caching it in `localStorage`. Replaced with `publicProfiles`; `getUsers()` deleted outright so the path cannot return. |
| ✅ | **B3** Forgeable session | The auth listener only handled a *signed-in* state, so a hand-edited cookie naming any uid was never contradicted. Firebase Auth is now authoritative. Verified: a forged session for another uid is rejected on load and cleared. |
| ✅ | **B10** Misleading claim | The sign-in screen promised a "secure 30-day browser cookie" that was neither `Secure`, `HttpOnly`, nor signed. |
| ✅ | **D1** Dead ranking engine | 274 lines imported and never called — every recorded interaction fed a model whose output nothing displayed. Now drives the home page. |
| ✅ | **C5** Pause restarted the track | Rows showed a pause icon but called `playTrack`. |
| ✅ | **C7** Dead search box | The navbar input had no `value` or `onChange`. |
| ✅ | **E2** 39 no-op utility classes | `h-22`, `w-84`, `animate-in`, `scrollbar-*` came from plugins that were never installed. |
| ✅ | **F1** Pinch-zoom blocked | `maximum-scale=1.0, user-scalable=no` in the viewport meta. |

Also fixed alongside B2: the picker **never wrote `collaboratorIds`**, the flat list the rules
gate collaborator writes on. Every collaborative playlist would have gone read-only for its
collaborators the moment the rules were deployed.

### Still open
Roughly two dozen high/medium findings, none critical:
- Bundle splitting — 872 kB in one chunk
- No error boundaries
- No retry on failed Firestore writes
- The router gap (§5)

---

## 7. Do these next, in order

1. **Revoke the GitHub token** that was pasted in plaintext, at
   `github.com/settings/tokens`. Treat it as compromised.
2. **Run Library Repair** with *Claim ownership* ticked, so existing tracks gain an `ownerId`.
3. **Deploy the rules** — `firebase deploy --only firestore:rules`. Until then none of §3 is
   in force.
4. **Redeploy the front end**, then hard-refresh. The Tailwind config changed and a stale
   cache renders half-styled.

---

## Appendix — commands

```bash
npm run dev      # Vite dev server on :5173
npm run build    # tsc && vite build
npm run preview  # serve the production build
```

```bash
firebase deploy --only firestore:rules
```
