"use client";
import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";
export function EventTracking({
  eventId,
  soldOut,
}: {
  eventId: string;
  soldOut: boolean;
}) {
  const tracked = useRef(false);
  useEffect(() => {
    if (soldOut && !tracked.current) {
      tracked.current = true;
      trackEvent("sold_out_view", { event_id: eventId, spots_remaining: 0 });
    }
  }, [eventId, soldOut]);
  return null;
}
