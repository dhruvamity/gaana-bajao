/**
 * Cookie Utilities for 30-Day Persistent Auth Session
 */

const SESSION_COOKIE_NAME = 'gaana_session_user';
const COOKIE_MAX_AGE_DAYS = 30;

export interface StoredSession {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  expiresAt: number; // Unix timestamp in ms
}

/**
 * Set a cookie with a 30-day expiration time
 */
export function setAuthCookie(sessionData: StoredSession, days = COOKIE_MAX_AGE_DAYS): void {
  const maxAgeSeconds = days * 24 * 60 * 60;
  const serialized = encodeURIComponent(JSON.stringify(sessionData));
  
  // Use SameSite=Lax and Path=/ for secure browser storage
  document.cookie = `${SESSION_COOKIE_NAME}=${serialized}; max-age=${maxAgeSeconds}; path=/; SameSite=Lax`;
}

/**
 * Retrieve the active auth session from cookies
 */
export function getAuthCookie(): StoredSession | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  for (const rawCookie of cookies) {
    const cookie = rawCookie.trim();
    if (cookie.startsWith(`${SESSION_COOKIE_NAME}=`)) {
      try {
        const rawValue = cookie.substring(`${SESSION_COOKIE_NAME}=`.length);
        const parsed: StoredSession = JSON.parse(decodeURIComponent(rawValue));
        
        // Check if explicitly expired
        if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
          clearAuthCookie();
          return null;
        }

        return parsed;
      } catch (err) {
        console.error('Failed to parse auth session cookie', err);
        return null;
      }
    }
  }
  return null;
}

/**
 * Delete the session cookie
 */
export function clearAuthCookie(): void {
  document.cookie = `${SESSION_COOKIE_NAME}=; max-age=0; path=/; SameSite=Lax`;
}

/**
 * Get the number of remaining days before the session expires
 */
export function getSessionDaysRemaining(expiresAt: number): number {
  const diffMs = expiresAt - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
