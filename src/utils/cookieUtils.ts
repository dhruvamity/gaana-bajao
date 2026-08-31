/**
 * Session-restore cookie.
 *
 * This cookie is NOT an authentication credential and must never be treated as
 * one. It is readable and writable by any script on the origin, it carries no
 * signature, and nothing here can make it trustworthy — a browser cookie set
 * from JavaScript cannot be `HttpOnly`, and a signature would need a secret
 * that a client bundle cannot hold.
 *
 * What it is: a hint that lets the shell paint the right name and avatar on the
 * first frame instead of flashing the sign-in screen. Authority over who the
 * user actually *is* belongs to Firebase Auth, and `AuthContext` discards this
 * cookie whenever Firebase disagrees with it.
 *
 * Consequences of that split, and why forging it gains nothing:
 *  - A forged `kind: 'firebase'` cookie is contradicted by Firebase Auth as
 *    soon as the listener settles, and the session is cleared.
 *  - A forged `kind: 'guest'` cookie names a local-only profile. Guests have no
 *    Firebase identity at all, so security rules — which key off
 *    `request.auth.uid` — deny every read and write regardless of what the
 *    cookie says. It buys a local UI label and nothing else.
 */

const SESSION_COOKIE_NAME = 'gaana_session_user';
const COOKIE_MAX_AGE_DAYS = 30;

/** Which authority, if any, stands behind this session. */
export type SessionKind = 'firebase' | 'guest';

export interface StoredSession {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  /**
   * `firebase` sessions are verified against Firebase Auth on every boot.
   * `guest` sessions are local-only and grant no server-side access.
   */
  kind: SessionKind;
  expiresAt: number; // Unix timestamp in ms
}

/** Guest profiles are minted locally with this prefix. */
export const GUEST_ID_PREFIX = 'user_guest_';

export function isGuestId(uid: string | undefined | null): boolean {
  return typeof uid === 'string' && uid.startsWith(GUEST_ID_PREFIX);
}

/**
 * Persist the restore hint.
 *
 * `Secure` is added whenever the page is served over HTTPS so the cookie is not
 * transmitted over plaintext; it is omitted on http://localhost, where setting
 * it would stop the cookie working in development.
 */
export function setAuthCookie(sessionData: StoredSession, days = COOKIE_MAX_AGE_DAYS): void {
  const maxAgeSeconds = days * 24 * 60 * 60;
  const serialized = encodeURIComponent(JSON.stringify(sessionData));
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';

  document.cookie = `${SESSION_COOKIE_NAME}=${serialized}; max-age=${maxAgeSeconds}; path=/; SameSite=Lax${secure}`;
}

/**
 * Read the restore hint.
 *
 * Everything here is untrusted input, so the shape is validated rather than
 * assumed: a hand-edited cookie should fail to parse into a session, not crash
 * the shell or produce a half-populated user.
 */
export function getAuthCookie(): StoredSession | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  for (const rawCookie of cookies) {
    const cookie = rawCookie.trim();
    if (!cookie.startsWith(`${SESSION_COOKIE_NAME}=`)) continue;

    try {
      const rawValue = cookie.substring(`${SESSION_COOKIE_NAME}=`.length);
      const parsed = JSON.parse(decodeURIComponent(rawValue)) as Partial<StoredSession>;

      if (typeof parsed?.uid !== 'string' || parsed.uid.length === 0) {
        clearAuthCookie();
        return null;
      }
      if (typeof parsed.expiresAt !== 'number' || Date.now() > parsed.expiresAt) {
        clearAuthCookie();
        return null;
      }

      // Cookies written before `kind` existed are inferred from the id shape,
      // so an existing session is not silently downgraded on upgrade.
      const kind: SessionKind =
        parsed.kind === 'firebase' || parsed.kind === 'guest'
          ? parsed.kind
          : isGuestId(parsed.uid)
            ? 'guest'
            : 'firebase';

      return {
        uid: parsed.uid,
        displayName: typeof parsed.displayName === 'string' ? parsed.displayName : null,
        photoURL: typeof parsed.photoURL === 'string' ? parsed.photoURL : null,
        kind,
        expiresAt: parsed.expiresAt
      };
    } catch (err) {
      console.error('Failed to parse auth session cookie', err);
      clearAuthCookie();
      return null;
    }
  }
  return null;
}

/**
 * Delete the session cookie.
 *
 * The attributes must match those used when setting it, or the browser treats
 * this as a different cookie and the original survives.
 */
export function clearAuthCookie(): void {
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${SESSION_COOKIE_NAME}=; max-age=0; path=/; SameSite=Lax${secure}`;
}

/**
 * Get the number of remaining days before the session expires
 */
export function getSessionDaysRemaining(expiresAt: number): number {
  const diffMs = expiresAt - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
