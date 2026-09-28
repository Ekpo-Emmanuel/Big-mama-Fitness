import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/lib/convex";
import { eventDateFull, eventTime, type DanceEvent } from "@/lib/event";
import {
  AdminPage,
  EmptyState,
  StatusBadge,
  adminPanel,
} from "@/components/admin-ui";
import { ArrowUpRight } from "lucide-react";
export default async function Admin() {
  await requireAdmin();
  const events: DanceEvent[] = await fetchAuthQuery(api.events.listAll, {});
  return (
    <AdminPage
      title="Your events"
      description="Everything you need to welcome your guests. Choose an event to get started."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {events.length === 0 ? (
          <EmptyState title="No events yet">
            Your events will appear here when they are set up.
          </EmptyState>
        ) : (
          events.map((event) => (
            <Link
              key={event.id}
              href={`/admin/events/${event.id}`}
              className={`${adminPanel} group transition hover:border-ink/30 focus-visible:outline-2 focus-visible:outline-offset-4`}
            >
              <div className="flex items-center justify-between gap-3">
                <StatusBadge status={event.status} />
                <ArrowUpRight size={20} aria-hidden="true" />
              </div>
              <h2 className="mt-5 text-xl font-semibold tracking-tight [overflow-wrap:anywhere]">
                {event.name}
              </h2>
              <p className="mt-2 text-sm text-ink/70">
                {eventDateFull(event)} · {eventTime(event)}
              </p>
              <p className="mt-1 text-sm text-ink/70">
                {event.venueName || event.addressLine1}, {event.city}
              </p>
              <p className="mt-6 border-t border-ink/10 pt-4 text-sm font-semibold">
                Manage event
              </p>
            </Link>
          ))
        )}
      </div>
    </AdminPage>
  );
}
