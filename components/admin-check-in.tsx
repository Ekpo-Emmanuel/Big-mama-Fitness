"use client";
import { Component, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { adminGuest } from "@/lib/admin-guest";
import { AdminGuests, type AdminGuest } from "./admin-guests";

class CheckInBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function AdminCheckInLive({
  eventId,
  initialRows,
  timezone,
}: {
  eventId: string;
  initialRows: AdminGuest[];
  timezone: string;
}) {
  const subscribed = useQuery(api.booking.listGuests, { eventId });
  const updateGuest = useMutation(api.guests.update).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.booking.listGuests, { eventId });
      if (!current) return;
      const now = new Date().toISOString();
      localStore.setQuery(
        api.booking.listGuests,
        { eventId },
        current.map((guest) => {
          if (guest.id !== args.attendeeId) return guest;
          if (args.action === "check_in") {
            if (guest.attendee_status === "checked_in") return guest;
            return {
              ...guest,
              attendee_status: "checked_in",
              checked_in_at: now,
            };
          }
          if (args.action === "undo_check_in") {
            if (guest.attendee_status !== "checked_in") return guest;
            return {
              ...guest,
              attendee_status: "confirmed",
              checked_in_at: null,
              checked_in_by: null,
            };
          }
          return guest;
        }),
      );
    },
  );

  const rows = subscribed ? subscribed.map(adminGuest) : initialRows;

  return (
    <AdminGuests
      rows={rows}
      checkIn
      live
      timezone={timezone}
      onLiveUpdate={async (attendeeId, action) => {
        await updateGuest({ attendeeId, action });
      }}
    />
  );
}

export function AdminCheckIn({
  eventId,
  initialRows,
  timezone,
}: {
  eventId: string;
  initialRows: AdminGuest[];
  timezone: string;
}) {
  return (
    <CheckInBoundary
      fallback={
        <AdminGuests rows={initialRows} checkIn timezone={timezone} />
      }
    >
      <AdminCheckInLive
        eventId={eventId}
        initialRows={initialRows}
        timezone={timezone}
      />
    </CheckInBoundary>
  );
}
