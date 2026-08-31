# Gaana-Bajao — QA Execution Report

**Build under test:** `7d89874` (initial pass); fixes verified on `docs/architecture-and-qa-report`
**Environment:** Chrome (automation), Vite dev server `localhost:5173`, React StrictMode **on**
**Session:** guest `user_guest_pvbu8`, 99-track live library, live Firebase project + Cloudinary
**Date:** 2026-08-31

---

## How these results were obtained

A temporary instrumentation probe was inserted into `index.html` ahead of the module
script, so it ran before React booted. It recorded: every top-level screen transition
(via `MutationObserver` + rAF sampling), every `new Audio()` with a serial number, every
`play`/`pause`/`load` on any media element, every `localStorage` write to a `gaana_*` key,
and every `fetch` carrying a `Range` header or targeting Cloudinary. **The probe has been
removed and `index.html` restored byte-for-byte** — `git status` is unchanged from the
start of the run and `tsc --noEmit` is clean.

Two harness limitations shaped the method, and they matter when reading the results:

| Limitation | Effect | Workaround |
| --- | --- | --- |
| Synthesized pointer clicks never reached the page (0 events received on a hit-testable, `elementFromPoint`-resolved button) | Could not drive the UI by mouse | Drove interactions with `element.click()` and dispatched events |
| `computer{key}` delivers `keydown` only — no `keyup`, and some key names don't map (`Return` arrived as `key: ""`, `Page_Up` produced nothing) | Enter/Space could not activate a button; one PageUp reading was a false negative | Used **real trusted key events** for all keyboard/focus assertions where `keydown` alone is sufficient, and re-ran stepping tests with dispatched events to remove multi-second round-trip drift |

Where a result comes from real trusted input it is marked **(real input)**. Everything
about focus, focus-visibility and arrow-key stepping was confirmed with real trusted key
events.

---

## Verdict

| Suite | Pass | Fail | Blocked |
| --- | --- | --- | --- |
| A — Authentication & Session | 3 | 1 | 1 (Google sign-in) |
| B — Library & Upload | 3 | 2 | 0 |
| C — Audio Engine & Telemetry | 5 | 3 | 0 |
| D — UI/UX & Access Control | 6 | 5 | 0 |

**23 defects.** Five were deploy-blocking. The headline result was not in any of the four
suites as written: it came from reviewing production access control, and is recorded in
gitignored `SECURITY-PRIVATE.md` rather than here — see *Access control* below.

**Status:** the defects marked ✅ in the register have been fixed on this branch and
re-verified against a running dev server. The remaining prerequisite for production is a
**data migration**, not a code change — see *Claiming ownership safely*.

---

## Access control — tracked privately

The pass included a review of the production Firestore access rules. The
findings are **deliberately not published here**: this repository is public, and
the details are actionable until the corrected rules are deployed.

They are recorded in `SECURITY-PRIVATE.md`, which is gitignored, alongside the
exact verification steps and the order of operations. Anyone with repo access
who needs them should read that file locally.

What can be said publicly, because it is visible in the diff anyway:

- `firestore.rules` in this repo is **not** what is currently deployed. Deploying
  it is a prerequisite for production.
- Deploying it was blocked by three incompatibilities between the rules and the
  client. **All three are fixed in this branch:** a `device_sessions` match block
  now exists and its documents carry a `userId`, the device-session listener is
  scoped with `where('userId','==',uid)`, and the telemetry query carries the
  same filter so the rules no longer reject it wholesale.
- One prerequisite remains and is **data, not code**: the 99 existing tracks
  carry no `ownerId`, so they must be migrated before the rules are enforced or
  they become permanently read-only. See *Claiming ownership safely* below.

---

## Claiming ownership safely

`ownerId` is matched against `request.auth.uid`. A guest session has no
`request.auth` at all, so a `user_guest_*` owner can never satisfy any rule —
running the migration from a guest session would write an id that is permanently
unusable, onto all 99 tracks at once.

**Run it signed in with Google.**

1. Open the account menu. If it shows a guest name, **Log out**.
2. Choose **Continue with Google** and complete the sign-in.
3. Confirm the session is really a Firebase one before migrating — in DevTools:

   ```js
   JSON.parse(decodeURIComponent(document.cookie.split('gaana_session_user=')[1])).kind
   ```

   This must print `"firebase"`. If it prints `"guest"`, stop and sign in again.

4. **Settings → Library Repair → Scan library.** Note the *Claim ownership of
   pre-existing tracks (N tracks)* count.
5. Tick **Claim ownership**. Leave artwork and metadata ticked; both report 0
   targets on the current library, so they are no-ops.
6. Click **Repair**.
7. **Rescan.** The ownership count must now be **0**. If it is not, do not
   deploy the rules yet.
8. Spot-check one track and confirm `ownerId` is a 28-character Firebase uid,
   not `user_guest_…`:

   ```js
   JSON.parse(localStorage.getItem('gaana_tracks'))[0].ownerId
   ```

Only once step 7 reports 0 is it safe to deploy the rules.

> The repair writes each track individually, so a library of 99 takes a little
> while. Leave the tab focused; it is not resumable mid-run, though re-running it
> is safe — tracks that already have an owner are skipped.

## Suite A — Authentication & Session Management

### A1 — Guest mode initialises and bypasses server-side identity — **PASS, with a finding**

| | |
| --- | --- |
| Expected | Guest login mints a local profile with no Firebase identity |
| Actual | `uid: user_guest_pvbu8`, `kind: "guest"`, prefix check passes, shell renders |

Guests genuinely bypass server-side identity: nothing in the guest path calls Firebase
Auth, so `request.auth` is null for every request such a session makes. What that currently
implies about server-side access is covered in `SECURITY-PRIVATE.md`.

**Finding (medium, shared-device privacy):** "Continue as Guest" does not create a guest. It
**silently resumes the previous guest's identity** — `firebase.ts:492-497` reuses any
existing `user_guest_*` profile from localStorage. After logging out, the next person to
click "Continue as Guest" is handed the previous person's library, likes and playlists,
under their name. `AuthModal` even passes the default name `'Guest Listener'`, which is
discarded in favour of the stored `"Dhruv"`. There is no UI path to a fresh guest session.

### A2 — 30-day cookie loads the shell with no sign-in flash — **PASS**

| | |
| --- | --- |
| Expected | No flash of the auth screen or the loading spinner |
| Actual | Screen transitions: `empty @ 0.4 ms → shell @ 37.7 ms`. Nothing else. |

The `useState` initialisers in `AuthContext.tsx:41` and `:60` read the cookie
synchronously, so the very first committed render is already the shell. `Initializing
Session…` never appeared; `Continue with Google` never appeared. Reproduced across four
cold loads.

The B10 copy fix is live and accurate — the auth screen now reads:

> "Signing in with Google keeps you signed in for 30 days; your account is verified with
> Google every time the app loads. Guest sessions stay on this device only and are not
> backed up."

No claim of `Secure`, `HttpOnly` or signing. Correct.

### A3 — Forged `uid` cookie is rejected — **PASS (primary) / FAIL (boundary)**

**A3a — forged `kind: "firebase"` cookie:**

| | |
| --- | --- |
| Expected | Firebase Auth contradicts it; session cleared |
| Actual | Cookie **cleared**, `currentUser` nulled, sign-in screen shown |

Screen transitions: `empty @ 1.2 ms → shell @ 64 ms → auth @ 75 ms`. This also proves the
`!fbUser` branch at `AuthContext.tsx:157-171` is live and firing.

Note the **11 ms optimistic window** in which the app renders as the forged user. That is a
UI window, not an authorization window — Firestore only ever honours the real ID token — so
under correct rules it is harmless. On a slow or offline connection it would be longer.

**A3b — forged cookie with a `user_guest_` uid but `kind: "firebase"`:**

| | |
| --- | --- |
| Expected | A cookie *claiming* a Firebase identity should be verified |
| Actual | **Survives indefinitely.** Shell renders as "Totally Not Me". No transition to auth. |

`AuthContext.tsx:165` exempts the session based on the **uid prefix**, ignoring the
cookie's own `kind` field — so a cookie that explicitly claims a Firebase identity escapes
verification just by naming a `user_guest_*` uid. Severity is low as designed (a guest has
no token, so it grants nothing server-side once rules are correct), but the check is
strictly weaker than intended and tightening it is one line:

```ts
// exempt only sessions that actually declare themselves local
if (isMounted && currentUserRef.current && storedKindRef.current !== 'guest') { … }
```

### A4 — Google Auth — **BLOCKED, not executed**

I cannot complete a Google sign-in: entering credentials into any field is off-limits for
me regardless of context. What was verified instead:

- Firebase Auth initialises (`🔥 Firebase initialized successfully`), `isAuthAvailable()`
  returns true
- `loginWithGoogle` has a `signInWithPopup` → `signInWithRedirect` fallback on
  `auth/popup-blocked` (`firebase.ts:395-400`), and `handleRedirectResult()` runs first in
  `initSession`
- The `onAuthStateChanged` listener is demonstrably live — A3a depends on it firing

**You need to run this one.** The specific thing to check afterwards: what `ownerId` a
Google-authenticated upload writes, and whether it equals `request.auth.uid`.

---

## Suite B — Library & Upload Workflow

### B1 — Cloudinary unsigned upload + jsmediatags extraction — **PASS**

Fixture: a purpose-built 12 s 440 Hz tone, 153,431 bytes, ID3v2.3, with an embedded
300×300 JPEG cover. Filename `qa-probe-tone.mp3` contains no `" - "`, so the filename
fallback would have produced title `"qa-probe-tone"` / artist `"Dhruv"`.

| Field | Filename fallback | ID3 tag | Rendered in queue |
| --- | --- | --- | --- |
| Title | qa-probe-tone | QA Probe Tone | **QA Probe Tone** ✓ |
| Artist | Dhruv | Automation Test Artist | **Automation Test Artist** ✓ |
| Album | Single | Regression Fixtures | **Regression Fixtures** ✓ |
| Genre | — | Test Signal | **Test Signal** ✓ |
| Cover | — | 300×300 JPEG | **two 300×300 blob previews** ✓ |
| Duration | — | — | **0:12** (from `decodeAudioData`) ✓ |

ID3 correctly beat the filename on every field. Both unsigned uploads returned **HTTP 200**
— audio to `/video/upload`, cover to `/image/upload` — and the Firestore document was
written with 20 fields, `artistId` canonically slugified to `artist_automation_test_artist`,
and acoustics computed (tempo 104, energy 0.35, acousticness 0.68 — plausible for a pure sine).

### B2 — Library Repair: bounded HTTP Range requests — **PASS, emphatically**

| | |
| --- | --- |
| Expected | Read only the leading tag bytes, not whole files |
| Actual | **200 requests for 100 tracks — exactly 2 each — all HTTP 206** |

| Measure | Value |
| --- | --- |
| Header probe | `Range: bytes=0-15` → 16 bytes |
| Tag read | sized from the ID3v2 synchsafe length, e.g. `bytes=0-90837` |
| Largest single read | 90,838 B of a **10,021,551 B** file — **0.9%** |
| Median read | 9,634 B |
| Total transferred | 7.1 MB for a library of ~1 GB |

`Content-Range: bytes 0-90837/10021551` confirms Cloudinary honours the header rather than
silently returning 200 with the whole body. The scan completed in 35.4 s at concurrency 4.

**Diagnosis categorisation:** 100 with tags, 100 with art, 0 needing artwork, 0 needing
metadata, **99 repairable** — the 99 being tracks missing `ownerId`. Every track landed in
`already-correct`, which is right for artwork but is the wrong headline given that 99 of
them are one rules-deploy away from being frozen. The `Diagnosis` union has no member for
"has everything except an owner", so the most urgent condition in the library has no line
of its own in the summary.

### B3 — Repair button ignores "Claim ownership" — **FAIL**

| | |
| --- | --- |
| Expected | With only "Claim ownership" ticked and 99 targets, repair should run |
| Actual | Button reads **"Repair 99 tracks"** and is **`disabled`** |

`LibraryRepairPanel.tsx:302` — `disabled={busy || (!restoreArtwork && !restoreMetadata)}`
omits `claimOwnership`. The label and the disabled state contradict each other, and the one
repair that actually matters right now cannot be run in isolation.

### B4 — Immutable `ownerId` — **PARTIAL**

`ownerId` is stamped at creation (`UploadModal.tsx:291`) and `repairLibrary` only fills it
when absent, never overwrites. Immutability is enforced *only* by `ownerUnchanged()` in the
undeployed rules — the client uses `setDoc` without merge (`firebase.ts:123`) and would
happily write a changed `ownerId`, which the currently-live rules accept.

**And the value is wrong for guests.** See the blocking section: `user_guest_pvbu8` can
never satisfy `request.auth.uid`.

### B5 — Tracks cannot be deleted — **FAIL**

`DatabaseService.deleteTrack` exists and is **called from nowhere in the UI** (verified by
grep across `src/components` and `src/App.tsx`). Upload the wrong file and it is in the
library permanently. `StorageService.deleteMedia` is a documented no-op, so the Cloudinary
blob leaks regardless — the QA upload's two assets had to be removed by hand.

---

## Suite C — Audio Engine & Telemetry

### C1 — Element is not rebuilt on track change — **PASS**

| | |
| --- | --- |
| Expected | Same `HTMLAudioElement` reused; playback survives |
| Actual | **0 new elements** across three track changes and one track-end advance |

Probe trace — one element (serial 2) taking successive sources:

```
t=60419.7  serial 2  load  …/wcaljekwpzszon9u2gbg.mp3
t=60419.7  serial 2  play  …/wcaljekwpzszon9u2gbg.mp3
t=78052.5  serial 2  load  …/nw9pdj4qihvk8rtzqoku.mp3     ← track change
t=78052.5  serial 2  play  …/nw9pdj4qihvk8rtzqoku.mp3
```

Serials 1 and 2 are the expected StrictMode double-mount, and serial 1 is properly
destroyed (`pause` + `load` with empty src). The `[]`-dep engine effect and the
`mediaHandlersRef` indirection are doing exactly what their comments claim.

### C2 — Analyser opt-in and fallback — **PASS on behaviour, FAIL on mechanism**

**Behaviour (PASS):** opening the full-screen player attaches the analyser, the fallback
fires, and playback is restored on a fresh element at the **exact** same position:

```
t=16679.6  serial 2  pause  ct=12.39      ← teardown
t=16679.7  serial 2  load   (src cleared)
t=16679.9  serial 3  load   same URL       ← rebuild
t=16699.1  serial 3  play   ct=12.39       ← resumed, 19.5 ms gap
```

Chrome independently confirms the design premise this whole mechanism exists for:

> `MediaElementAudioSource outputs zeroes due to CORS access restrictions for https://res.cloudinary.com/…mp3`

And the UI degrades honestly — the player shows *"Spectrum view is unavailable for this
source, so playback stays audible."*

**Mechanism (FAIL — `AudioEngine.enableAnalyser`, `audioEngine.ts:123`):** the fallback did
**not** come from the 800 ms verification. It fired after **114 ms**, and the console
explains why:

> `Analyser unavailable: InvalidStateError: Failed to execute 'createMediaElementSource' on 'AudioContext': HTMLMediaElement already connected previously to a different MediaElementSourceNode.`

`enableAnalyser` is not re-entrancy-safe. `isContextInitialized` is set only *after* two
`await`s, so two concurrent calls both pass the guard. The second throws, and its `catch`
calls `teardownGraph()` — which nulls `this.analyser` **while the first call is still
polling it**. `waitForSignal`'s `if (!this.analyser) return finish(false)` then trips
immediately, and the engine reports silence it never measured.

Consequences: the 800 ms window is dead code in practice; the logged diagnosis is a guess;
and `analyserUnavailable = true` latches for the whole engine lifetime, so the visualiser is
permanently disabled after one race. React StrictMode triggers this on every dev mount
(`NowPlayingModal.tsx:396`), and in production any two overlapping calls — a fast
open/close/open — do the same.

Fix: latch the in-flight promise at the top.

```ts
private analyserPromise: Promise<boolean> | null = null;
public enableAnalyser(): Promise<boolean> {
  return (this.analyserPromise ??= this.attachAnalyser());
}
```

### C3 — Telemetry — **PASS on three, FAIL on one**

| Event | Expected | Actual | |
| --- | --- | --- | --- |
| `stream_30s` | once per track at 30 s | 30.14 s and 30.22 s on **different** tracks 80 s apart — the `hasLogged30sRef` guard holds | ✅ |
| `stream_complete` | once at track end, correct duration | one event, `durationPlayed: 160.4` on a 160 s track; queue advanced; no element rebuild | ✅ |
| `skip_early` via track card | once | one event, `14.29 s` | ✅ |
| **`skip_early` via Next button** | once | **two events** | ❌ |

**Duplicate skip telemetry — reproduced:**

```json
{"action":"skip_early","dur":14.29,"track":"6566725_90","id":"evt_1788120910847_pfup"}
{"action":"skip_early","dur":14.29,"track":"6566725_90","id":"evt_1788120910846_0cv9"}
```

Same track, same duration, timestamps 1 ms apart. `nextTrack()` logs the skip with its own
inline `progress < 30` rule (`AudioContext.tsx:281-283`), then calls `playTrack()`, which
classifies the *same* abandonment through `RecommendationEngine` and logs it again
(`:225-230`). The D1 change single-sourced one call site and left the other.

Impact: every Next-button skip is a double negative signal at reward `-2.0` each, and
`generateHomeShelves` consumes exactly these events — so skipped tracks are penalised twice
as hard as the thesis specifies. It also doubles telemetry write volume.

**Related, code-derived (not reproduced):** the same `nextTrack` branch fires at the *end*
of any track shorter than 30 s, since `progress ≈ duration < 30`. Such a track would log
both `stream_complete` and `skip_early`. Not reachable during this run — the 12 s fixture
was removed before the completion test.

**Also:** repeat-one seeks to 0 without resetting `hasLogged30sRef`, so a looped track logs
`stream_30s` only on its first pass.

### C4 — 15-second broadcast cadence — **PASS undisturbed, FAIL under interaction**

**Undisturbed playback:**

| Beat | at | position |
| --- | --- | --- |
| 1 | 13.5 s | `pos=121.6 playing=true` |
| 2 | 28.5 s | `pos=136.7 playing=true` |

Gap **15.02 s**; position advanced 15.1 s. Exactly `PLAYBACK_HEARTBEAT_MS`. ✅

**Under volume interaction — FAIL.** `broadcastNow` (`AudioContext.tsx:169-177`) depends on
`volume`, so every volume change both fires an immediate broadcast *and* tears down and
restarts the 15 s interval. Nudging volume once every 5 s produced beats at 5.0, 5.0, 5.0,
5.0 s — the 15 s timer never matured once.

Simulating a single continuous drag:

| | |
| --- | --- |
| Input events | 40 over ~1.8 s |
| Broadcasts | **40** |
| Position in every one | identical (`pos=204.7`) |

Each broadcast is a Firestore `setDoc` plus a synchronous localStorage JSON round trip.
The comment above that hook says the goal was to stop "about 14,000 writes per hour" from
`progress` — but `volume` is just as continuous, so the same problem simply moved from the
seek bar to the volume slider. One second of dragging ≈ 40 writes against a 20,000/day
free-tier quota.

Fix: read volume through a ref the same way `progress` already is.

### C5 — Device-session writes fail whenever nothing is playing — **FAIL**

On every cold load, twice:

> `Firestore device session warning: FirebaseError: Function setDoc() called with invalid data. Unsupported field value: undefined (found in field currentTrackId in document device_sessions/dev_fzq57lh)`

`ConnectSyncService.broadcastState` passes `currentTrackId: state.currentTrackId`, which is
`undefined` before a track is chosen; Firestore rejects `undefined` outright. Connect &
Handoff never syncs until playback starts. Caught and warned, so it fails silently.

---

## Suite D — UI/UX & Access Control

### D1 — `md` breakpoint transition — **PASS at the boundary, FAIL in the middle**

Measured, no horizontal overflow at any width:

| Viewport | Left nav | Content column | Desktop player | Mobile dock | Tab bar |
| --- | --- | --- | --- | --- | --- |
| 1440 | 310 px | **784 px** | 112 px | — | — |
| 1280 | 310 px | **624 px** | 112 px | — | — |
| 1100 | 310 px | **444 px** | 112 px | — | — |
| 1024 | 310 px | **368 px** | 112 px | — | — |
| **768** | 310 px | 458 px | 112 px | — | — |
| **767** | hidden | 767 px | hidden | ✓ | 79 px |
| 375 | hidden | 375 px | hidden | ✓ | 79 px |

The 768/767 flip is exactly clean — nav and desktop player out, dock and tab bar in, in one
step, with no overflow. Mobile tab targets are 78 px tall (well past the 44 px minimum) and
the three labels render correctly.

**FAIL — the 1024–1300 px band.** The Now Playing rail appears at `lg` (1024) and takes a
fixed 346 px, leaving the content column at **368 px — narrower than a 375 px phone.** This
is the most common laptop range (1280×800, 1366×768). Card width collapses to 175 px at
1100 px. The rail should either start at `xl`, or flex instead of holding 346 px.

### D2 — Deterministic fallback artwork — **PASS on generation, FAIL on seeding**

**Expired-link recovery (PASS):** firing `error` on a live `res.cloudinary.com` `<img>`
swapped it to a `data:image/svg+xml` generated cover — `CoverArt.tsx:52-54` works.

**Determinism (FAIL):** the same playlist rendered **two visibly different covers on the
same screen**. Both carry initials `2B`, both declared at size 600, but:

```
hsl(141 78% 24%) → hsl(241 59% 45%)      green→indigo
hsl( 84 60% 25%) → hsl(164 57% 52%)      olive→teal
```

The seed is `${artist}::${title}::${id}`. `HomeView.tsx:199-202` passes only `title` and
`id`; `LibrarySidebar.tsx:119`, `PlaylistsDirectoryView.tsx:182` and `MediaCard.tsx:59` all
also pass `artist={ownerName}`. Different seed string → different FNV-1a hash → different
hue, saturation, gradient angle and ring geometry.

This directly contradicts the guarantee in `coverArt.ts`: *"the same song always renders the
same artwork across reloads and devices."* Fix: add `artist` at `HomeView.tsx:201`, or
better, build the seed once per entity so no call site can get it wrong.

### D3 — Keyboard scrubbing — **PASS discrete, FAIL repeated** (real input)

Discrete presses on a paused track, `max = 160`:

| Key | Expected | Actual |
| --- | --- | --- |
| ArrowRight ×3 | +5 s each | 32.33 → 37.33 → 42.33 → **47.33** ✓ |
| ArrowLeft | −5 s | 47.33 → **42.33** ✓ |
| PageUp | +15 s | 42.33 → **57.33** ✓ |
| PageDown | −15 s | 57.33 → **42.33** ✓ |
| Home | 0 | **0.36** ✓ |
| End | max | **160.1** ✓ |

Every step exactly to spec, and `aria-valuenow` / `aria-valuetext` ("2:16 of 2:40") track
correctly. *(An earlier PageUp reading of "no movement" was the harness failing to map
`Page_Up`, not an app fault.)*

**FAIL — repeated presses do not accumulate.** Five `ArrowLeft` dispatched back-to-back:

| | |
| --- | --- |
| Expected | −25 s (160.1 → 135.1) |
| Actual | **−5 s** (160.1 → **155.1**) |

`Scrubber.handleKeyDown` computes `next` from the `value` **prop** on every press
(`Scrubber.tsx:88, :92`). Within one React batch the prop hasn't updated, so all five
presses compute `160 − 5` and the last write wins. A keyboard user holding ArrowLeft at the
OS repeat rate moves the playhead five seconds total. The component already keeps a pending
`dragValue` for pointer drags — keyboard needs the same.

### D4 — Focus visibility — **PASS globally, FAIL on the scrub handle** (real input)

| | |
| --- | --- |
| Expected | Every interactive control shows focus |
| Actual | **508 / 508 tabbable controls** show `outline: 2px solid rgb(30,215,96)`. Zero offenders. |

The `:focus-visible` reset at `index.css:31` does exactly what its comment claims. Correct
modality behaviour too: programmatic `.focus()` before any real key press did *not* paint a
ring; the first trusted key press did.

**FAIL — the scrub thumb stays invisible under keyboard focus.** `scrub-thumb` opacity was
`0` at every step of the keyboard test, including while actively seeking. `index.css:238`
reveals it on `.scrub-track:hover` only, and `:239` turns the fill green on hover only. So a
keyboard user gets a focus ring around the track but **no handle showing where the playhead
is going**. The native volume `input[type=range]` in the same footer handles this correctly
(`index.css:197` includes `:focus-visible::-webkit-slider-thumb`) — the custom Scrubber is
inconsistent with its own neighbour.

### D5 — Tab order — **FAIL**

| | |
| --- | --- |
| Total tab stops on Home | **508** |
| Inside the content column | 454 |
| First footer control | stop **493** |
| **Play/Pause** | stop **499** |
| Seek slider | stop **502** |
| Skip link | **none** |

A keyboard user must press Tab 498 times to reach the play button. Landmarks are present
(`main`, `header`, `footer`, two `nav`), so screen-reader users can jump — but a
keyboard-only sighted user cannot.

Root cause is the `MediaCard` pattern: each card contributes ~2 stops because the stretched
overlay button *and* the play FAB are both focusable. That overlay was the right fix for the
invalid nested-`<button>` DOM, but it doubled keyboard traversal cost. Give the overlay
`tabIndex={-1}` and let the FAB carry activation, and add a skip link.

### D6 — Search — **PASS**

`"krrish"` → 3 tracks, correct hits. `"zzzzqqqnothing"` → `Results: 0 tracks` with a proper
empty state, no crash, category counts intact.

---

## Navigation — no router (specifically requested)

| Action | Expected | Actual |
| --- | --- | --- |
| In-app back arrow | LIFO unwind, disables when empty | **Correct.** `playlists → search → home`, then disabled. ✅ |
| Any in-app navigation | — | URL stays `/`; `history.length` **never increments** |
| Browser Back | — | **Full document unload.** Lands on the previous *document*, view resets to Home, in-app stack wiped, playback stops |
| Refresh | — | View → Home, stack empty, **player bar gone entirely**, track lost, playback stopped |

The in-app stack itself works well — `App.tsx:77-84` correctly reads the entry outside the
state updater so StrictMode's double-invoke can't double-pop.

Everything around it is the cost of having no router:

- **Nothing is linkable.** No playlist, artist or search result has a URL.
- **Browser Back is destructive.** From two views deep it discarded both, tore down the
  React tree and killed playback. For a first-time visitor (`history.length === 1`) Back
  exits the site outright.
- **Refresh loses everything** — including the now-playing track, even though the last
  position is sitting in `gaana_device_sessions` in localStorage the whole time.

The cheapest meaningful fix is not a full router: push a history entry in `navigate()` /
`pushHistory()` and handle `popstate` by calling `goBack()`. That alone makes browser Back
and the in-app arrow agree, without inventing URL schemes.

---

## Defect register

✅ = fixed on this branch and re-verified against a running dev server.
Line references are to the build under test, before the fix.

### Deploy-blocking

| # | Defect | Where | |
| --- | --- | --- | --- |
| 1 | Access-control review — details withheld, see `SECURITY-PRIVATE.md` | deployed rules ≠ `firestore.rules` | needs deploy |
| 2 | All 99 tracks have no `ownerId` → frozen the moment rules deploy | data | **needs migration** |
| 3 | Guest `ownerId` can never satisfy `request.auth.uid`; claiming ownership as a guest makes it permanent | `UploadModal.tsx:291` | documented — see *Claiming ownership safely* |
| 4 | `device_sessions` not covered by the new rules; Connect & Handoff breaks on deploy | `firebase.ts:664, :677` | ✅ |
| 5 | Telemetry query lacks `where userId ==` → rejected wholesale by the new rules | `firebase.ts:~630` | ✅ |

### High

| # | Defect | Where | |
| --- | --- | --- | --- |
| 6 | Duplicate `skip_early` on every Next press (reproduced) | `AudioContext.tsx:281` + `:225` | ✅ |
| 7 | Volume slider fires one Firestore write per input event (40 → 40 measured) | `AudioContext.tsx:169-187` | ✅ |
| 8 | 9 full `tracks` reads per cold load — 891 doc reads, 638 KB (dev; ~4–5 in prod) | `firebase.ts:87`, all consumers | open |
| 9 | Repeated arrow keys don't accumulate: 5 presses = 1 step | `Scrubber.tsx:88` | ✅ |
| 10 | Play/Pause is tab stop 499 of 508; no skip link | `MediaCard.tsx`, `App.tsx` | open |
| **24** | **Content column could not be scrolled at all** — `.app-panel { overflow: hidden }` beat Tailwind's `overflow-y-auto` on source order, hiding 9,795 px of every view. Programmatic `scrollTop` still worked, so nothing in the code looked broken. | `index.css:51` | ✅ |

### Medium

| # | Defect | Where | |
| --- | --- | --- | --- |
| 11 | `enableAnalyser` not re-entrancy-safe; misreports CORS silencing; latches off permanently | `audioEngine.ts:123` | open |
| 12 | Same playlist renders two different generated covers | `HomeView.tsx:199` | ✅ |
| 13 | Section headings collapse to 0 px wide on mobile | `SectionHeader.tsx:34` | open |
| 14 | Content column is 368 px at a 1024 px viewport | `App.tsx:244` | open |
| 15 | Repair button disabled while labelled "Repair 99 tracks" | `LibraryRepairPanel.tsx:302` | open |
| 16 | "Continue as Guest" resumes the previous guest's library after logout | `firebase.ts:492` | open |
| 17 | `device_sessions` write fails with `invalid-argument` when nothing is playing | `connectSync.ts:47` | ✅ |
| 18 | Scrub thumb never appears on keyboard focus | `index.css:238` | ✅ |
| 19 | No UI can delete a track; Cloudinary blobs leak | `deleteTrack` uncalled | open |

### Low

| # | Defect | Where | |
| --- | --- | --- | --- |
| 20 | Guest-prefix exemption ignores the cookie's declared `kind` | `AuthContext.tsx:165` | open |
| 21 | `logout()` skips `clearAuthCookie()` if `signOut()` rejects | `AuthContext.tsx:257-267` | open |
| 22 | Repeat-one doesn't reset `hasLogged30sRef` | `AudioContext.tsx:267` | ✅ |
| 23 | Sub-30 s track would log `stream_complete` **and** `skip_early` (code-derived) | `AudioContext.tsx:281` | ✅ |

**12 fixed, 11 open**, of which one (#2) is a data migration and one (#1) is a deploy.

---

## What passed, on the record

- Cookie restore paints the shell in 37.7 ms with no auth or loading flash
- Forged Firebase-identity cookie is rejected and cleared
- Media element is never rebuilt on track change — the `[]`-dep engine effect holds
- Analyser fallback preserves position to the centisecond with a ~20 ms gap, and degrades
  with honest UI copy; Chrome independently confirms the CORS premise
- Connect heartbeat is 15.02 s under undisturbed playback
- `stream_30s` once per track; `stream_complete` once with the right duration; queue advances
- Range reads: 2 per track, all 206, 0.9% of the largest file, 7.1 MB total
- ID3 beat the filename on every field; both Cloudinary unsigned uploads returned 200
- Breakpoint flips cleanly at 768/767 with zero horizontal overflow at every width
- Generated artwork recovers from a dead Cloudinary link
- Arrow / Home / End / PageUp / PageDown all step exactly to spec on discrete presses
- Focus visible on 508 of 508 tabbable controls
- In-app back stack unwinds LIFO and disables correctly when empty
- Search returns correct hits and a proper empty state

---

## Cleanup performed

- `index.html` instrumentation removed, file restored from backup — `git status` identical
  to the start of the run, `tsc --noEmit` clean
- `public/qa-probe-tone.mp3` and the `public/` directory removed
- QA Firestore document `tracks/track_1788121350989_0` deleted (verified 404)
- Local track cache purged; library back to 99 tracks
- Original guest session and `gaana_users` restored; viewport emulation reset

### Two things left for you

**1. Orphaned Cloudinary assets.** Unsigned uploads can't be deleted client-side
(`storageService.ts:70`), so these must go through the Cloudinary console:

```
video/upload/v1788121352/m1buv6uytljvchihimfy.mp3
image/upload/v1788121353/rbtigkptgxw5f9haigaq.jpg
```

**2. Verify the rules after deploying.** The check is in `SECURITY-PRIVATE.md` §1 —
run it once the corrected rules are live and confirm it reports a denial.
