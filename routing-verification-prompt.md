# Task: Runtime-only verification pass for Gaana-Bajao's URL routing — fix anything that fails

## Why this pass exists, and the ground rule

Two prior audits (`AUDIT-2026-08-31.md`, `STATUS.md`) marked routing and browser history as **PASS / Working**, "verified by code inspection." It wasn't working: `pushState()` was being called without a URL argument, so no view ever had a real address, and every Share button copied the same wrong link regardless of what was open. That got marked done because it was checked by reading the code, not by loading a URL cold.

**Ground rule: nothing below counts as verified unless you actually did it** — hard refresh, fresh incognito tab, curl, or pasted clipboard content — **and you can describe what you saw.** "The code looks correct" is not a pass. If something fails, fix it, then re-verify the same way before moving on to the next item.

Treat the routing work from the previous task as unverified, not as done. This is a from-scratch audit of it, not a review of its own summary.

## Checklist

**Build**
- [ ] `tsc --noEmit` — 0 errors
- [ ] `vite build` — 0 errors

**Every route, loaded cold** (paste the URL directly or open a fresh tab — don't click into it from within the app)
- [ ] `/`, `/search`, `/playlists`, `/liked` each load the right view
- [ ] `/playlist/:id` for a real playlist, and `/artist/:id` for a real artist, each load the actual content — not just the right shell with a loading spinner stuck forever
- [ ] `/track/:id` for a real track loads that track into the player
- [ ] Repeat the same set via **hard refresh** while already sitting on that route (Cmd/Ctrl+R), not just a fresh tab — these can fail independently of each other, check both

**Cold and logged out**
- [ ] Open a `/playlist/:id` link in a fresh incognito window with no existing session — confirm you land on the sign-in gate, then **after** completing sign-in you land on that exact playlist, not Home. Repeat for `/track/:id`.

**Share buttons — check all six independently, they were all broken before**
- [ ] Playlist card on Home
- [ ] Playlist card in the Playlists directory
- [ ] The playlist page's own Share button
- [ ] The artist page's Share button
- [ ] Now Playing sidebar's Share button
- [ ] Now Playing (fullscreen) modal's Share button

For each: click Share, paste the clipboard content somewhere visible, confirm the URL matches the specific item you shared (not whatever page you happened to be on), and confirm opening that pasted URL in a new tab actually opens that specific item.

**Bad or missing ids**
- [ ] `/playlist/<an id that doesn't exist>` and `/track/<an id that doesn't exist>` — a real "not found" message, not a blank screen, not a crash, nothing uncaught in the browser console

**Navigation behavior**
- [ ] Start a song playing, then navigate through 3–4 different views — confirm in the browser, not by reading the code, that audio keeps playing without restarting or cutting out
- [ ] A multi-step sequence (e.g. Home → playlist → artist → Liked Songs), then Back three times, then Forward twice — each step lands on the expected view and the URL matches what's rendered
- [ ] Scroll down on a long view, navigate away, navigate back — the new view opens scrolled to the top
- [ ] The Navbar back arrow shows/hides sensibly (not present with nothing to go back to, present once you've navigated somewhere)

**Hosting / production**
- [ ] Confirm the actual production host (check `firebase.json` for a `hosting` block, or `vercel.json` / `netlify.toml` / `_redirects` — ask Dhruv if it's still ambiguous) has an SPA rewrite/fallback rule in place. **`vite preview` will not catch a missing rewrite rule — it serves every path locally regardless of hosting config — so this needs checking against the real deploy target, not the local preview server.** If it's already deployed, `curl -I` a deep path against the real domain (e.g. `https://<actual domain>/playlist/anything`) and confirm it returns 200 with the app's HTML, not a 404.

**Regression check** — routing touched shared app state, confirm nothing nearby broke
- [ ] The three-dot playlist edit/delete menus still work, and deleting the currently-open playlist correctly redirects to `/`
- [ ] `onTracksChanged` / cache invalidation still refreshes views after an upload or delete
- [ ] Connect & Handoff device sync still opens and works
- [ ] No new console warnings introduced (React Router future-flag warnings, duplicate-key warnings, etc.)

## What to report back

A pass/fail line per checklist item above, each with the specific action you took to verify it — the exact URL, the exact button, what you actually saw — not a restatement of the checklist item as if it were the evidence. Fix anything that fails and re-verify it the same way before marking it done.
