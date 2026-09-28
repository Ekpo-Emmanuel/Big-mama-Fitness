"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

export function FeedbackPageView({ eventId }: { eventId: string }) {
  useEffect(() => {
    trackEvent("feedback_page_view", { event_id: eventId });
  }, [eventId]);
  return null;
}
