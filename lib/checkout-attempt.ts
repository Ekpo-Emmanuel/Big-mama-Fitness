export {
  REGISTRATION_COMPLETE_MESSAGE,
  isRegistrationCompleteError,
} from "./registration-intent";

const ATTEMPT_PREFIX = "afro_checkout_";
const DRAFT_PREFIX = "afro_register_draft_";

const attempts = new Map<string, string>();

export function checkoutStorageKey(eventId: string) {
  return ATTEMPT_PREFIX + eventId;
}

export function registrationDraftKey(eventId: string) {
  return DRAFT_PREFIX + eventId;
}

export function checkoutRequestKey(eventId: string) {
  const storageKey = checkoutStorageKey(eventId);
  try {
    const saved = sessionStorage.getItem(storageKey);
    if (saved && /^[a-f0-9-]{36}$/.test(saved)) return saved;
  } catch {}
  const value = attempts.get(eventId) || crypto.randomUUID();
  attempts.set(eventId, value);
  try {
    sessionStorage.setItem(storageKey, value);
  } catch {}
  return value;
}

export function resetCheckoutAttempt(eventId: string) {
  attempts.delete(eventId);
  try {
    sessionStorage.removeItem(checkoutStorageKey(eventId));
  } catch {}
}

/** After paid success: drop active intent so next registration mints a new key. */
export function clearActiveRegistration(eventId: string) {
  resetCheckoutAttempt(eventId);
  try {
    sessionStorage.removeItem(registrationDraftKey(eventId));
  } catch {}
}
