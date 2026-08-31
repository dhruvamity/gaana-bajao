# Gaana-Bajao — Fix Prompt

**Repo:** gaana-bajao (React + TypeScript + Firebase + Cloudinary, Firebase project `jazzba2`)
**Based on:** full repo audit, 2026-08-31 (42 modules, ~11,000 lines; 15 of 25 QA issues already closed)

Fix every issue below, in priority order (P0 → P4). Treat this as the complete scope — don't fix things not listed here, and don't re-touch anything already working.

**Ground rules:**
- Line numbers below are from the 2026-08-31 audit — verify against current code before editing, they may have shifted since.
- Don't touch working functionality: auth, playback engine, upload pipeline, library repair, recommendation engine, home shelves, playlist CRUD/artwork, Connect & Handoff, telemetry, search/explore, track ownership, Firestore `undefined`-stripping, taste onboarding, security rules content, public profiles.
- Run lint/typecheck/build (and tests, if present) after each fix before moving to the next.
- Keep each fix scoped to its issue — no drive-by refactors.
- At the end, report per issue: what changed, files touched, how you verified it.

---

## P0 — Blocking Production

**1. Deploy Firestore rules + indexes**
Rules exist but aren't live — all access control is currently unenforced. The bad single-field index on `tracks.createdAt` in `firestore.indexes.json` has already been removed; only the `telemetry` composite index (userId ASC + timestamp DESC) should remain.
- Confirm `firestore.indexes.json` now only has the `telemetry` composite index.
- If you have Firebase CLI credentials: run `firebase deploy --only firestore:rules,firestore:indexes --project jazzba2` and confirm it succeeds.
- If you don't have deploy credentials, say so explicitly and give the exact command back to the user to run themselves — don't skip silently.
- Verify with the check in `SECURITY-PRIVATE.md` §1 — it must report a denial.

**2. Library has no playable audio**
Cloudinary assets behind the 5 remaining track docs were deleted; those docs likely 404 on playback now.
- Sanity-check that `LibraryRepairPanel.tsx` / `libraryRepair.ts` correctly classify these as source-missing (code-level check only).
- The actual scan-and-remove + re-upload is a runtime/UI action, not a code change — flag it back to the user: run Library Repair to clear the 5 dead entries, then re-upload signed in with Google (not Guest).

---

## P1 — No Router

**3. Views aren't linkable; Back exits the app; refresh loses state**
`App.tsx:39` — current view is a plain string with no browser-history integration.
- Minimum fix (matches the audit's own suggested approach): make `navigate()`/`pushHistory()` also call `history.pushState()`, and add a `popstate` listener that syncs view state on Back/Forward.
- Verify: Back/Forward move between views; a hard refresh on a non-home view doesn't drop back to the default.
- Deep-linking to specific playlists/tracks (e.g. full React Router) is a larger scope change — confirm with the user before expanding into that.

---

## P2 — High Priority

**4. Full `tracks` collection re-fetched everywhere**
`firebase.ts:113` (+ all consumers) — 9 independent full-collection reads per cold load (891 doc reads for one page view); every component fetches `getTracks()` independently. Compounded by `firebase.ts:184-185`, where `getArtists()` calls `getTracks()` internally, so `getArtistById → getArtists → getTracks` triple-fetches for a single artist lookup.
- Add one shared cache for `getTracks()` (React context or module-level cache) and point all call sites at it.
- Rewire `getArtists()` to read from the shared cache instead of calling `getTracks()` directly.

**5. Accessibility: Play/Pause is tab stop 499 of 508**
`MediaCard.tsx`, `App.tsx` — each `MediaCard` currently costs two tab stops (stretched overlay + play FAB); no skip link exists.
- Collapse each `MediaCard` to one tab stop (make the overlay non-focusable/`aria-hidden` and keep the FAB as the single interactive target, or the reverse — whichever fits the existing click behavior).
- Add a "skip to player controls" link near the top of the DOM order.

**6. 890 kB single chunk, no code splitting**
`vite.config.ts` — 228 kB gzip, one chunk, nothing lazy-loaded.
- Add `React.lazy` + `Suspense` for heavy views (Upload, Playlist, Search/Explore, etc.).
- Add manual chunk config in `vite.config.ts` for large third-party deps.

**7. No error boundaries**
`App.tsx` — a single render throw currently blanks the whole app.
- Add an `ErrorBoundary` component and wrap `<MainAppContent>` in it, with a minimal fallback UI.

**8. `logInteractionInternal` rebuilds ~4x/sec**
`AudioContext.tsx:274` — `progress` is a `useCallback` dependency, so the callback identity changes on every progress tick.
- Read `progress` from a ref inside the callback instead of depending on it, so the callback identity stays stable.

---

## P3 — Medium Priority

**9. `enableAnalyser` not re-entrancy-safe**
`audioEngine.ts:123` — a second concurrent call throws `InvalidStateError`, and its catch block tears down the first call's analyser.
- Add a guard (in-flight flag/promise, or idempotent create-if-missing) so concurrent calls can't race.

**10. Section headings collapse to 0px on mobile**
`SectionHeader.tsx:22-38` (specifically the `flex-shrink-0` on line 34) — the meta label won't shrink, so the title gets squeezed to nothing on narrow viewports.
- Give the title `min-width: 0` + truncation; let the meta label shrink or wrap instead of the title.

**11. Content column narrower than a phone at 1024px**
`App.tsx:244` — 368px content column at a 1024px viewport when the Now Playing rail is open.
- Adjust the grid/breakpoint so the content column keeps a sane minimum width with the rail open (collapse the rail earlier, or push the three-column breakpoint wider).

**12. Guest identity leaks across logout**
`AuthContext.tsx:257-267` (root cause) / surfaces via `firebase.ts:516-524` ("Continue as Guest") — `logout()` clears `gaana_active_user` but not the matching entry in the `gaana_users` array, so the next guest session silently reuses the previous guest's identity/library on a shared device.
- In `logout()`, also remove the current guest's entry from `gaana_users`.

**13. Firestore write failures are silently dropped**
Throughout `firebase.ts` — failed writes are `console.warn`'d, with no retry, queue, or user feedback.
- Add retry and/or a visible failure state (e.g. toast) when a write ultimately fails, instead of only logging to console.

**14. `handleTrackEnded` stale closure**
`AudioContext.tsx:355-364` — plain function called via `mediaHandlersRef`; can read stale `isRepeat`/`currentTrack` if the ref update races the `ended` event.
- Read `isRepeat`/`currentTrack` from refs inside the handler so it can't go stale.

**15. `HomeView` doesn't cancel on unmount**
`HomeView.tsx:49-64` — `loadData`'s `Promise.all` has no cleanup; fast navigation away triggers setState-on-unmounted warnings.
- Add an `isMounted` guard or `AbortController`, and a cleanup function in the `useEffect`.

---

## P4 — Low Priority

**16. Guest-prefix exemption ignores cookie's declared `kind`**
`AuthContext.tsx:165` — checks an ID prefix pattern instead of reading the cookie's own `kind` field.
- Check `kind` directly.

**17. `logout()` skips `clearAuthCookie()` if `signOut()` rejects**
`AuthContext.tsx:257` — cookie clearing is skipped entirely if `signOut()` throws.
- Wrap in `try`/`finally` so `clearAuthCookie()` always runs regardless of `signOut()`'s outcome.

**18. Fake `monthlyListeners`/`velocity` shown as real**
`firebase.ts:213-216` — both are `Math.random()`, displayed as if real stats.
- Replace with a real computed value (e.g. derived from telemetry/listen counts), or clearly mark as placeholder in the UI — don't leave random numbers presented as fact.

---

## Flagged, not required (per the audit itself)

- **`mediaHandlersRef` rebuilds every render** (`AudioContext.tsx:446-476`) — audit calls this "acceptable as-is... a code smell." Optional cleanup once #14 is stabilized via refs; skip unless time permits.
- **`deleteMedia` is a no-op** (`storageService.ts:70-73`) — audit calls this "by design," not a bug; Cloudinary blobs are orphaned on track delete. Real deletion needs a server-side call (an API secret can't live client-side) — flag to the user as a scope decision rather than fixing unilaterally.

---

## Final checklist
- [ ] P0–P3 fixed and individually verified
- [ ] Lint/typecheck/build clean
- [ ] Rules/indexes deployed; `SECURITY-PRIVATE.md` §1 check reports a denial
- [ ] Per-issue change summary delivered
