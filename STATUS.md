# Gaana-Bajao — Application Status

**As of:** 2026-08-31 · `main` @ `4e5ba46` · PRs #1–#4 merged
**Build:** `tsc --noEmit` clean · `vite build` clean · 890.61 kB JS (227.78 kB gzip), 50.93 kB CSS
**Source:** ~11,000 lines across 42 modules

---

## 1. Where the app stands

| Area | State |
| --- | --- |
| Shell, navigation, both breakpoints | **Working** |
| Scrolling | **Working** — was completely broken, fixed in #2 |
| Playback engine | **Working** — but there is no audio left to play (§3) |
| Playlist artwork & custom covers | **Working** |
| Library Repair (scan / repair / remove) | **Working** |
| Telemetry & ranking | **Working locally**; Firestore side needs an index deploy |
| Connect & Handoff | **Working**; will need the rules deploy to stay working |
| Access control | **NOT deployed** — the single biggest open item (§2) |
| Track ownership migration | **Done** — all tracks carry a real Firebase uid |

### Current data

- **5 track documents**, down from 99 after the cleanup in §3
- **1 playlist**, `trackIds` automatically pruned 99 → 5
- All tracks owned by `S7s5D8nC…` (a real Firebase uid, not a guest id)
- Telemetry: local only, because the composite index is not deployed

---

## 2. Blocking production

### 2.1 Firestore rules and indexes are not deployed — **critical**

`firestore.rules` in the repo is not what is running — re-confirmed today. The evidence, the exact commands and the post-deploy verification step are in gitignored **`SECURITY-PRIVATE.md`**; they are deliberately not repeated here, because this repository is public and they remain actionable until the corrected rules are live.

**Everything that previously blocked this deploy is now cleared:**

| Former blocker | State |
| --- | --- |
| Tracks with no `ownerId` | ✅ migrated — all carry a real Firebase uid |
| `device_sessions` uncovered by rules | ✅ `match` block added, documents carry `userId` |
| Telemetry query rejected wholesale | ✅ `where('userId','==',uid)` added |

**Nothing stands in the way of deploying now.** The Firebase CLI is not installed on this machine, so this needs you:

```bash
npm i -g firebase-tools && firebase login && firebase deploy --only firestore:rules,firestore:indexes
```

Deploy **both** targets. The indexes matter as much as the rules — the telemetry query currently fails with `failed-precondition` and silently falls back to local events, so the home shelves are running on this-device history only.

Afterwards, re-run the check in `SECURITY-PRIVATE.md` §1; it must report a denial.

### 2.2 No router — **high**

Nothing is linkable, browser Back unloads the app and resets to Home, and a refresh loses the current view, the back stack and the playing track. The in-app back arrow works correctly; it just has no relationship to the browser's own history.

Cheapest real fix is not a router: push a history entry in `navigate()` / `pushHistory()` and handle `popstate` by calling `goBack()`. That alone makes browser Back and the in-app arrow agree.

---

## 3. The library has no audio

The Cloudinary assets were deleted. Because track documents live in Firestore and know nothing about the stored blobs, the catalogue survived intact while every file behind it vanished.

**What was done:** Library Repair now distinguishes *"the host says this is gone"* (HTTP 404/410) from *"this failed to load"* (CORS, transient network), and only ever removes the former. 94 of 99 were classified `source-missing` and removed; the playlist was pruned automatically.

**What remains:** the 5 that still resolved at scan time have since begun returning 404 as Cloudinary's CDN cache expired. A scan reflects reachability at the moment it ran, so **run one more scan-and-remove pass** to clear them — after which the library will be empty and ready for re-upload.

**Worth knowing for next time:**

- Deleting storage objects does **not** remove tracks from the app. The two are independent by design.
- Unsigned Cloudinary uploads **cannot be deleted from the client** (`storageService.ts` `deleteMedia` is a documented no-op), so removing a track leaves its blob behind. Cleanup is manual, in the Cloudinary console.
- There is no bulk re-upload or "restore from originals" path. Re-uploading is one pass through the upload modal.

---

## 4. Open issues

Numbering continues from `QA-REPORT.md`. **15 of 25 are now closed.**

### High

| # | Issue | Where |
| --- | --- | --- |
| 8 | 9 full `tracks` collection reads per cold load — 891 document reads, 638 kB, for one page view. Every component fetches the catalogue independently; there is no shared cache. ~4–5 in production (StrictMode doubles it in dev). | `firebase.ts:87` + all consumers |
| 10 | Play/Pause is tab stop **499 of 508**, with no skip link. Each `MediaCard` costs two stops (stretched overlay + play FAB). | `MediaCard.tsx`, `App.tsx` |
| — | **Bundle is a single 890 kB chunk** (228 kB gzip), over Vite's warning threshold. No code splitting or lazy routes. | `vite.config.ts` |
| — | **No error boundaries.** One render throw blanks the whole app. | `App.tsx` |

### Medium

| # | Issue | Where |
| --- | --- | --- |
| 11 | `enableAnalyser` is not re-entrancy-safe. Two concurrent calls make the second throw `InvalidStateError`, whose `catch` tears down the first call's analyser — so the "silenced by CORS" warning is reported without ever being measured, and the visualiser latches off permanently. | `audioEngine.ts:123` |
| 13 | Section headings collapse to **0 px wide** on mobile. A long uppercase meta label has `flex-shrink-0` and wins the row; "Made For Dhruv" renders at zero width. | `SectionHeader.tsx:34` |
| 14 | Content column is **368 px at a 1024 px viewport** — narrower than a phone. The 346 px Now Playing rail appears at `lg` and squeezes it across the whole 1024–1300 px band, which is most laptops. | `App.tsx:244` |
| 16 | "Continue as Guest" silently **resumes the previous guest's identity**, library and likes after a logout. A shared-device privacy problem; there is no path to a fresh guest session. | `firebase.ts:492` |
| — | Failed Firestore writes are warned to the console and dropped. No retry, no queue, no user feedback — the app looks like it saved. | `firebase.ts` throughout |

### Low

| # | Issue | Where |
| --- | --- | --- |
| 20 | The guest-prefix exemption ignores the cookie's declared `kind`, so a cookie claiming `kind: "firebase"` survives verification just by naming a `user_guest_*` uid. UI spoofing only; grants no server access under correct rules. | `AuthContext.tsx:165` |
| 21 | `logout()` skips `clearAuthCookie()` if `signOut()` rejects — the session cookie outlives a failed sign-out. | `AuthContext.tsx:257` |
| — | `monthlyListeners` and `velocity` on every artist are `Math.random()`, regenerated each fetch. Presented in the UI as real figures. | `firebase.ts` `getArtists()` |

### Closed since the QA pass

`#2` ownership migrated · `#4` device_sessions rules · `#5` telemetry filter · `#6` duplicate `skip_early` · `#7` volume write amplification · `#9` arrow-key accumulation · `#12` inconsistent playlist covers · `#15` repair button gating · `#17` `device_sessions` undefined · `#18` scrub thumb on focus · `#19` no delete-track path · `#22` repeat-one 30s flag · `#23` sub-30s double log · `#24` unscrollable content column · `#25` Firestore `undefined` rejecting whole writes

---

## 5. Do these next, in order

1. **Deploy rules and indexes** (§2.1). Everything that blocked it is cleared. Verify with the check in `SECURITY-PRIVATE.md`.
2. **Second scan-and-remove pass** to clear the last 5 dead entries (§3).
3. **Re-upload the library.** Uploads carry a real Firebase uid now, so they will satisfy the deployed rules — provided you are signed in with Google, not as a Guest.
4. **Fix the catalogue read amplification** (#8). A shared cache is the single biggest cost and latency win available.
5. **Wire browser history to the view stack** (§2.2). Small change, disproportionate usability gain.
6. **Split the bundle and add an error boundary.**

---

## 6. Notes on operating this app

- **Always sign in with Google before uploading or repairing.** A guest's `user_guest_*` id can never satisfy `request.auth.uid`, so anything a guest writes becomes unwritable the moment rules are enforced.
- **`SECURITY-PRIVATE.md` is gitignored and must stay that way** while this repo is public.
- **Cloudinary blobs are never deleted by the app.** Removing a track removes the record only.
- Two personal access tokens were pasted in plaintext during development. Revoke both at github.com/settings/tokens if not already done; `gh` is on a keyring browser login and does not depend on them.
