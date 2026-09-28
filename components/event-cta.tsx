"use client";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import { type DanceEvent, eventState, money } from "@/lib/event";
import { buttonClass } from "./ui";
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
      {open ? `Reserve My Spot — ${money(event)}` : "Join the Next Class List"}
      <span aria-hidden="true">↗</span>
    </Link>
  );
}
