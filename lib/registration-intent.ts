/** Paid requestKey must not start another checkout. */
export const REGISTRATION_COMPLETE_MESSAGE =
  "This registration is already complete. Start a new registration.";

export function isRegistrationCompleteError(message: string) {
  return message.includes("already complete");
}
