# Task: Real URL routing for Gaana-Bajao (fix refresh + shareable links)

## Context — why this is needed

`AUDIT-2026-08-31.md` and `STATUS.md` both mark "Browser History / Routing" as **PASS / Working**, verified "by code inspection." That verification was wrong. `src/App.tsx` calls:

```ts
window.history.pushState(
  serializeViewState({ view, artistId: selectedArtistId, playlist: selectedPlaylist }),
  ''
);
```

`pushState(state, title)` is called with **no third `url` argument**, so the browser's address bar never changes — Home, any playlist, any artist all live at the exact same URL. What currently "works" is that `window.history.state` (an in-memory blob tied to one browser tab's session) is read back on mount, which happens to survive a same-tab refresh — but it's invisible to a new tab, another device, or anyone you send a link to.

This is also why every Share button is silently broken. Six places call `navigator.clipboard.writeText(window.location.href)`: `PlaylistView.tsx`, `ArtistView.tsx`, `PlaylistsDirectoryView.tsx`, `HomeView.tsx`, `NowPlayingSidebar.tsx`, `NowPlayingModal.tsx`. Since the URL never changes, all six copy the same root link regardless of what's open, then show a "Copied!" toast that isn't true.

**Goal:** every meaningful view gets a real, distinct, bookmarkable URL; all six Share buttons build the correct link; a hard refresh or a cold-opened link (new tab, new device, logged out) lands on the exact right screen.

## Approach: react-router-dom

Add `react-router-dom` (v6, or v7 in **declarative** mode only — `BrowserRouter` / `Routes` / `Route` / `useNavigate` / `useParams` / `useLocation`. Do **not** adopt the v7 data-router/loader API — that's a bigger restructure than this needs). It isn't a dependency yet (checked `package.json`). It costs some bundle size on top of the recent 890kB→134kB work, but it's a small, well-tested library and worth it — the manual `pushState`/`popstate` approach is exactly what produced this bug, so don't patch it further, replace it.

## Target URL scheme

| Path | Renders | Notes |
|---|---|---|
| `/` | HomeView | |
| `/search` | SearchExploreView | Optionally mirror the query into `?q=` so results are shareable too — nice to have, not required |
| `/playlists` | PlaylistsDirectoryView | |
| `/playlist/:playlistId` | PlaylistView | Fetch by id — see step 6 |
| `/liked` | PlaylistView, fed a synthetic liked-songs playlist | Dedicated path — **not** `/playlist/pl-liked-collection`. That id isn't a real Firestore doc, don't try to fetch it as one |
| `/artist/:artistId` | ArtistView | Already takes `artistId` and self-fetches — least work here |
| `/track/:trackId` | No dedicated page — loads the track and opens the existing fullscreen player | See step 8 |
| anything else | A small "not found" view | New component — don't crash |

## Implementation steps

1. **`npm install react-router-dom`.**

2. **Wrap the app in `<BrowserRouter>`** — in `src/main.tsx`, or around the export in `src/App.tsx`.

3. **In `src/App.tsx`**, replace the conditional block that currently renders `HomeView` / `SearchExploreView` / `PlaylistsDirectoryView` / `ArtistView` / `PlaylistView` (`currentView === 'home' && ...`, etc., roughly lines 282–335) with `<Routes>` / `<Route>`. Keep everything **around** that block exactly where it is, outside `<Routes>` — `LibrarySidebar`, `Navbar`, `NowPlayingSidebar`, `MiniPlayer`, `MobileMiniPlayer`, `MobileTabBar`, and all the modals. This is a layout route: only the content column swaps per-route. **This matters for audio** — `AudioProvider`, the `<audio>` element, and `MiniPlayer` must stay mounted across every navigation, or switching pages will cut off playback. Verify this explicitly at the end, don't just assume the architecture makes it true.

4. **Delete the manual routing state** — the `history` array, `pushHistory()`, `isInternalPop` ref, the `popstate` `useEffect`, `serializeViewState` / `SerializedViewState`. Replace:
   - the local `navigate(view: string)` function with `useNavigate()`'s `navigate('/search')` etc. — you'll have a naming collision between the two, rename one
   - `handleSelectArtist(artistId)` → `navigate(\`/artist/${artistId}\`)`
   - `handleSelectPlaylist(playlist)` → `navigate(\`/playlist/${playlist.id}\`)`. Optionally also pass what you already have via `navigate(path, { state: { playlist } })` so the route can render instantly from it while still independently fetching by id as the source of truth (needed for refresh/shared-link anyway)
   - `handleSelectLikedSongs()` → `navigate('/liked')`
   - `goBack()` → `navigate(-1)`. For the back button's visibility (`canGoBack`, currently `history.length > 0`), use `useLocation().key !== 'default'` — react-router sets `key` to `'default'` only on the very first entry of the session
   - the scroll-to-top-on-navigate that's currently inline in each handler → a small effect keyed on `useLocation().pathname` that resets `mainRef`'s scroll and `isScrolled`, or it'll quietly disappear when the per-handler code is deleted
   - `LibrarySidebar` and `MobileTabBar` currently take `currentView` / `selectedPlaylistId` / `selectedArtistId` as props to highlight the active nav item — keep that highlighting working by deriving it from `useLocation()` / `useParams()` (either read the hooks directly in those components, or keep deriving it in the parent and passing it down, whichever is less churn)

5. **Add two methods to `DatabaseService` in `src/services/firebase.ts`** — neither exists yet:
   - `getPlaylistById(playlistId: string): Promise<Playlist | null>` — mirror `getArtistById` exactly (it already does this pattern for artists): call `getPlaylists()`, then `.find(p => p.id === playlistId) || null`.
   - `getTrackById(trackId: string): Promise<Track | null>` — same idea, but via the already-cached `getTracks()` (it has a module-level `_tracksCache`): call `getTracks()`, then `.find(t => t.id === trackId) || null`. Don't add a second, separate cache.

6. **`/playlist/:playlistId` route**: `PlaylistView` currently requires a full `playlist: Playlist` prop, not an id. Either add a thin wrapper that reads `useParams()`, calls `getPlaylistById`, and handles loading/not-found before rendering the existing `PlaylistView` unchanged, or teach `PlaylistView` to accept an id and self-fetch (mirroring how `ArtistView` already works). Don't rewrite `PlaylistView`'s internals beyond what's needed to feed it a playlist.

7. **`/liked` route**: build the same synthetic playlist object `handleSelectLikedSongs()` builds today (from `currentUser.likedTrackIds`), no Firestore fetch, render it through `PlaylistView`. Needs `currentUser` from `useAuth()` — by the time any route renders, the app's existing top-level auth gate guarantees that's non-null.

8. **`/track/:trackId` route ("song links")**: fetch the track via `getTrackById`, call the existing `playTrack(track)` from `useAudio()`, then open `NowPlayingModal` — it already has a `logInteraction('share', currentTrack.id)` call in its own share handler, so sharing what's currently playing and landing back in that same fullscreen player is clearly the intended round trip, not a new page. After loading, `navigate('/', { replace: true })` so the URL doesn't stay pinned on a launcher path. Handle two edge cases:
   - track id not found (deleted) → the not-found view, not a blank screen
   - `audio.play()` can be rejected by the browser's autoplay policy on a cold load with no prior user gesture — catch that rejection and leave the track loaded-but-paused with the player visibly ready, don't let it throw

   Note: the address bar should **not** switch to `/track/:id` just because a song is playing — that path is only ever generated by the explicit Share action, as a string, without navigating there. An ordinary play click keeps whatever page you're already on (e.g. you're still on `/playlist/:id` while a track from it plays).

9. **Fix all six Share call sites.** For `PlaylistView.tsx` and `ArtistView.tsx`, once routing is real, `window.location.href` happens to be correct *while already on that page* — leave those, but confirm it during testing. For `PlaylistsDirectoryView.tsx`, `HomeView.tsx`, and `NowPlayingSidebar.tsx`, the Share button lives on a card inside a grid/list, so `window.location.href` at click time is the grid's URL (`/` or `/playlists`), not the specific item's — these three **must** build the target URL explicitly from the item's own id (e.g. `${window.location.origin}/playlist/${playlist.id}`), not read the ambient current URL. For `NowPlayingModal.tsx`, build `${window.location.origin}/track/${currentTrack.id}`.

10. **Hosting fallback — the part local testing won't catch.** `firebase.json` currently has no `"hosting"` key at all:
    ```json
    {
      "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" }
    }
    ```
    Every SPA needs the host to serve `index.html` for any path, so the client-side router gets a chance to run before the server 404s. If this deploys to Firebase Hosting (implied by the existing `jazzba2` Firestore project — confirm with Dhruv if that's not actually where the frontend is hosted), add:
    ```json
    {
      "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" },
      "hosting": {
        "public": "dist",
        "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
        "rewrites": [{ "source": "**", "destination": "/index.html" }]
      }
    }
    ```
    (`"public": "dist"` matches Vite's default build output — `vite.config.ts` doesn't override `build.outDir`.) If it's actually deployed elsewhere (Vercel, Netlify, GitHub Pages), add that host's equivalent SPA-fallback config instead, and say so in your summary — don't silently assume Firebase.

## Explicitly out of scope

Rich link previews (a song or playlist's name and cover showing up when the link is pasted into WhatsApp/iMessage/Twitter) need per-route Open Graph tags, which a pure client-rendered SPA can't produce — the crawler that builds the preview never runs your JS, it only ever sees the one static `index.html`. That needs prerendering or a small SSR/edge function and is a separate task. Don't attempt it here; just don't let its absence block this one.

## Acceptance criteria — verify by doing, not by reading code

Don't check anything off based on reading the code — that's the exact mistake the last audit made. Run `npm run build && npm run preview`, then for each line below, actually do it:

- [ ] Navigate Home → a playlist → an artist → Liked Songs → back → back — URL bar changes correctly at every step, browser Back/Forward both work
- [ ] Hard refresh (not a re-render) on `/playlist/:id`, `/artist/:id`, `/liked`, `/playlists`, `/search` — each lands on the right screen, not Home
- [ ] Open a `/playlist/:id` and a `/track/:id` URL in a **fresh incognito window** with no existing session — you should hit the Google sign-in gate, and after signing in, land on that exact playlist/track, not Home
- [ ] Click Share on: a playlist card on Home, a playlist card in the Playlists directory, the playlist page itself, an artist page, and the Now Playing modal — paste the clipboard content each time and confirm it's a distinct, correct URL for what you actually shared
- [ ] Play a song, then navigate across two or three different views — audio does not stop or restart
- [ ] Visit `/playlist/does-not-exist` and `/track/does-not-exist` — a graceful message, no crash, no blank page, no uncaught error in the browser console
- [ ] `tsc --noEmit` and `vite build` stay clean

## What to report back

Files changed, the new dependency, any assumption you had to make (especially the hosting target), and confirmation that every box above was actually exercised, not inferred.
