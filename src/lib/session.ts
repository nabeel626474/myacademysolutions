/**
 * One-hour sign-in window.
 * A staff member has to sign in again once their session is older than an hour,
 * even if they simply left the tab open.
 */
import { supabase } from "@/integrations/supabase/client";

const KEY = "mas_signin_at";
export const SESSION_MAX_MS = 60 * 60 * 1000;

export function markSignIn() {
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* storage unavailable */
  }
}

export function clearSignInStamp() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

function storedStamp(): number | null {
  try {
    const raw = localStorage.getItem(KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Signs the user out when the session is older than an hour. Returns true if expired. */
export async function enforceSessionAge(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) {
    clearSignInStamp();
    return false;
  }

  const lastSignIn = session.user.last_sign_in_at
    ? Date.parse(session.user.last_sign_in_at)
    : NaN;
  const startedAt = storedStamp() ?? (Number.isFinite(lastSignIn) ? lastSignIn : Date.now());
  if (storedStamp() === null) markSignIn();

  if (Date.now() - startedAt > SESSION_MAX_MS) {
    clearSignInStamp();
    await supabase.auth.signOut();
    return true;
  }
  return false;
}

/** Re-checks every minute while the app is open (and when the tab regains focus). */
export function watchSessionAge(onExpired: () => void) {
  let stopped = false;
  const check = async () => {
    if (stopped) return;
    if (await enforceSessionAge()) onExpired();
  };
  void check();
  const timer = window.setInterval(check, 60_000);
  window.addEventListener("focus", check);
  return () => {
    stopped = true;
    window.clearInterval(timer);
    window.removeEventListener("focus", check);
  };
}
