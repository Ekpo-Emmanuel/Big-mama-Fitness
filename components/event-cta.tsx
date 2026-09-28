"use client";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import { type DanceEvent, eventState, money } from "@/lib/event";
import { buttonClass } from "./ui";
import { ArrowRight } from "lucide-react";
export function EventCta({
  event,
  sold,
  className = "",
}: {
  event: DanceEvent;
  sold: number;
  className?: string;
}) {
  const open = eventState(event, sold) === "open";
  return (
    <Link
      onClick={() => {
        if (open)
          trackEvent("reserve_spot_click", {
            event_id: event.id,
            event_name: event.name,
            ticket_price: event.priceCents / 100,
            currency: event.currency,
            spots_remaining: Math.max(0, event.capacity - sold),
          });
      }}
      className={`${buttonClass} ${className}`}
      href={
        open
          ? `/event/${event.slug}/register`
          : `/event/${event.slug}#next-class`
      }
    >
      {open ? `Reserve My Spot` : "Join the Next Class List"}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}
