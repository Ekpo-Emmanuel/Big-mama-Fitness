"use client";
import { useEffect } from "react";
import { clearActiveRegistration } from "@/lib/checkout-attempt";

/**
 * After paid confirmation renders, close the ACTIVE registration intent.
 * Keeps success page working (token in URL). Next register mints a new key.
 */
export function ClearActiveRegistration({
  eventId,
  paid,
}: {
  eventId: string;
  paid: boolean;
}) {
  useEffect(() => {
    if (!paid) return;
    clearActiveRegistration(eventId);
  }, [eventId, paid]);
  return null;
}
