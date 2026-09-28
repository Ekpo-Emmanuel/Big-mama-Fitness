export {
  REGISTRATION_COMPLETE_MESSAGE,
  isRegistrationCompleteError,
} from "./registration-intent";

const ATTEMPT_PREFIX = "afro_checkout_";
const DRAFT_PREFIX = "afro_register_draft_";
const COOKIE_PREFIX = "afro_rk_";
const KEY_RE = /^[a-f0-9-]{36}$/;
/** Two hours — covers hold window + cancel/retry. */
const COOKIE_MAX_AGE_SEC = 2 * 60 * 60;

const attempts = new Map<string, string>();

export function checkoutStorageKey(eventId: string) {
  return ATTEMPT_PREFIX + eventId;
}

export function registrationDraftKey(eventId: string) {
  return DRAFT_PREFIX + eventId;
}

function cookieName(eventId: string) {
  return COOKIE_PREFIX + eventId;
}

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split("; ");
  for (const part of parts) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i) !== name) continue;
    return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  // SameSite=Lax survives top-level return from Stripe Checkout.
  const secure =
    typeof location !== "undefined" && location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie =
    name +
    "=" +
    encodeURIComponent(value) +
    "; Path=/; Max-Age=" +
    COOKIE_MAX_AGE_SEC +
    "; SameSite=Lax" +
    secure;
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = name + "=; Path=/; Max-Age=0; SameSite=Lax";
}

function persistKey(eventId: string, value: string) {
  attempts.set(eventId, value);
  try {
    sessionStorage.setItem(checkoutStorageKey(eventId), value);
  } catch {}
  try {
    writeCookie(cookieName(eventId), value);
  } catch {}
}

/** Restore a known ACTIVE requestKey (cancel_url ?rk= or cookie recovery). */
export function adoptCheckoutRequestKey(eventId: string, requestKey: string) {
  if (!KEY_RE.test(requestKey)) return false;
  persistKey(eventId, requestKey);
  return true;
}

export function checkoutRequestKey(eventId: string) {
  const storageKey = checkoutStorageKey(eventId);
  try {
    const saved = sessionStorage.getItem(storageKey);
    if (saved && KEY_RE.test(saved)) {
      persistKey(eventId, saved);
      return saved;
    }
  } catch {}

  try {
    const fromCookie = readCookie(cookieName(eventId));
    if (fromCookie && KEY_RE.test(fromCookie)) {
      persistKey(eventId, fromCookie);
      return fromCookie;
    }
  } catch {}

  const value = attempts.get(eventId) || crypto.randomUUID();
  persistKey(eventId, value);
  return value;
}

export function resetCheckoutAttempt(eventId: string) {
  attempts.delete(eventId);
  try {
    sessionStorage.removeItem(checkoutStorageKey(eventId));
  } catch {}
  try {
    clearCookie(cookieName(eventId));
  } catch {}
}

/** After paid success: drop active intent so next registration mints a new key. */
export function clearActiveRegistration(eventId: string) {
  resetCheckoutAttempt(eventId);
  try {
    sessionStorage.removeItem(registrationDraftKey(eventId));
  } catch {}
}

/** Query param name for Stripe cancel_url round-trip. */
export const REQUEST_KEY_QUERY = "rk";
