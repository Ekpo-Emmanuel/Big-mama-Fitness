import type { Attendee } from "@/lib/booking";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { fetchAuthQuery } from "@/lib/auth-server";
import { getEvent } from "@/lib/db";
import { api } from "@/lib/convex";
import {
  FEEDBACK_SENTIMENT_LABELS,
  type FeedbackSentiment,
} from "@/lib/feedback";
import { AdminGuests } from "@/components/admin-guests";
import { AdminCheckIn } from "@/components/admin-check-in";
import { adminGuest } from "@/lib/admin-guest";
import { AdminLeads } from "@/components/admin-leads";
import {
  AdminPage,
  Metric,
  Detail,
  EmptyState,
  StatusBadge,
  adminPanel,
  adminSecondary,
  formatAmount,
  formatDate,
} from "@/components/admin-ui";
import { eventDateFull, eventTime } from "@/lib/event";
import { AdminEditEventForm } from "@/components/admin-edit-event-form";
import { AdminDeleteEventButton } from "@/components/admin-delete-event";

type FeedbackSummary = {
  count: number;
  average: number | null;
  eligible: number;
  responseRate: number | null;
  sentimentCounts: Record<FeedbackSentiment, number>;
  items: {
    id: string;
    firstName: string;
    lastName: string;
    rating: number;
    sentiment: FeedbackSentiment | null;
    enjoyedMost: string;
    improvement: string;
    submittedAt: string;
    updatedAt: string;
  }[];
};
export default async function EventView({
  params,
}: {
  params: Promise<{ id: string; view: string }>;
}) {
  await requireAdmin();
  const { id, view } = await params;
  const event = await getEvent(id);
  if (
    !event ||
    !["guests", "leads", "check-in", "feedback", "details"].includes(view)
  )
    notFound();
  const titles: Record<string, string> = {
    guests: "Guests",
    leads: "Next Class Leads",
    "check-in": "Check-in",
    feedback: "Guest feedback",
    details: "Event details",
  };
  const descriptions: Record<string, string> = {
    guests:
      "Confirmed guests first. Keep incomplete checkouts and cancelled registrations in their own view.",
    leads:
      "People interested in future classes. This is not a cancellation waitlist; no seats are automatically offered.",
    "check-in": "Find your guest. Tap check in. Welcome them in.",
    feedback:
      "What your guests enjoyed, and what could make the next class better.",
    details: "Your published event information and registration setup.",
  };
  let content;
  if (view === "details") {
    content = (
      <div className="grid gap-5 lg:grid-cols-2">
        <section className={adminPanel}>
          <h2 className="text-lg font-semibold">The event</h2>
          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <Detail label="Event name">{event.name}</Detail>
            <Detail label="Instructor">{event.instructorName}</Detail>
            <Detail label="Date">{eventDateFull(event)}</Detail>
            <Detail label="Event time">
              {eventTime(event)}–{eventTime(event, event.endsAt)}
            </Detail>
            <Detail label="Workout">
              {eventTime(event, event.workoutStartsAt)}–
              {eventTime(event, event.workoutEndsAt)}
            </Detail>
            <Detail label="Timezone">{event.timezone}</Detail>
            <Detail label="Location">
              {[
                event.venueName,
                event.addressLine1,
                event.city,
                event.province,
                event.postalCode,
              ]
                .filter(Boolean)
                .join(", ")}
            </Detail>
            <Detail label="Contact email">
              {event.contactEmail || "Not set"}
            </Detail>
          </dl>
        </section>
        <section className={adminPanel}>
          <h2 className="text-lg font-semibold">Registration</h2>
          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <Detail label="Ticket price">
              {formatAmount(event.priceCents, event.currency)} {event.currency}
            </Detail>
            <Detail label="Capacity">{event.capacity} tickets</Detail>
            <Detail label="Publication">
              <StatusBadge status={event.status} />
            </Detail>
            <Detail label="Registration setting">
              {event.registrationOpen ? "Enabled" : "Disabled"}
            </Detail>
          </dl>
          <p className="mt-5 text-xs leading-relaxed text-ink/65">
            Availability also depends on the event date, status and remaining
            inventory. Cancellations and refunds do not reopen seats.
          </p>
          <Link
            href={`/event/${event.slug}`}
            className={`${adminSecondary} mt-5`}
          >
            View public event
          </Link>
        </section>
        <section className={`${adminPanel} lg:col-span-2`}>
          <h2 className="text-lg font-semibold">Edit event</h2>
          <p className="mt-2 text-sm text-ink/70">
            Changes apply to the public page and new checkouts. Guests who already
            paid keep their original waiver copy.
          </p>
          <div className="mt-5">
            <AdminEditEventForm event={event} />
          </div>
          <div className="mt-5">
            <AdminDeleteEventButton event={event} />
          </div>
        </section>
      </div>
    );
  } else if (view === "feedback") {
    const feedback = (await fetchAuthQuery(api.feedback.listForEvent, {
      eventId: id,
    })) as FeedbackSummary;
    content = (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metric
            label="Average rating"
            value={feedback.average == null ? "—" : `${feedback.average} / 5`}
          />
          <Metric label="Responses" value={feedback.count} />
          <Metric
            label="Response rate"
            value={
              feedback.responseRate == null ? "—" : `${feedback.responseRate}%`
            }
            detail={`Of ${feedback.eligible} eligible paid guests`}
          />
        </div>
        <section className={adminPanel}>
          <h2 className="font-semibold">How the class felt</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {(Object.keys(feedback.sentimentCounts) as FeedbackSentiment[]).map(
              (key) => (
                <li key={key}>
                  <div className="mb-2 flex justify-between gap-3 text-sm">
                    <span>{FEEDBACK_SENTIMENT_LABELS[key]}</span>
                    <span className="font-semibold tabular-nums">
                      {feedback.sentimentCounts[key]}
                    </span>
                  </div>
                  <meter
                    aria-label={FEEDBACK_SENTIMENT_LABELS[key]}
                    min={0}
                    max={Math.max(1, feedback.count)}
                    value={feedback.sentimentCounts[key]}
                    className="h-3 w-full accent-ink"
                  />
                </li>
              ),
            )}
          </ul>
        </section>
        {!feedback.items.length && (
          <EmptyState title="No feedback yet">
            Guest responses will appear here after they complete the feedback
            form.
          </EmptyState>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          {feedback.items.map((item) => (
            <article
              key={item.id}
              className={`${adminPanel} [overflow-wrap:anywhere]`}
            >
              <div className="flex flex-wrap justify-between gap-3">
                <h2 className="font-semibold">
                  {item.firstName} {item.lastName}
                </h2>
                <StatusBadge status="accepted">
                  {item.rating} / 5 stars
                </StatusBadge>
              </div>
              {item.sentiment && (
                <p className="mt-2 text-sm text-ink/70">
                  {FEEDBACK_SENTIMENT_LABELS[item.sentiment]}
                </p>
              )}
              <dl className="mt-5 space-y-4">
                {item.enjoyedMost && (
                  <Detail label="Enjoyed most">{item.enjoyedMost}</Detail>
                )}
                {item.improvement && (
                  <Detail label="For next time">{item.improvement}</Detail>
                )}
              </dl>
              <p className="mt-5 text-xs text-ink/60">
                {formatDate(item.submittedAt, event.timezone)}
              </p>
            </article>
          ))}
        </div>
      </div>
    );
  } else if (view === "leads") {
    const leads = await fetchAuthQuery(api.leads.list, { eventId: id });
    content = <AdminLeads rows={leads} timezone={event.timezone} />;
  } else if (view === "check-in") {
    const guests = (await fetchAuthQuery(api.booking.listGuests, {
      eventId: id,
    })) as Attendee[];
    content = (
      <AdminCheckIn
        eventId={id}
        initialRows={guests.map(adminGuest)}
        timezone={event.timezone}
      />
    );
  } else {
    const [guests, pending, confirmation] = await Promise.all([
      fetchAuthQuery(api.booking.listGuests, { eventId: id }) as Promise<
        Attendee[]
      >,
      fetchAuthQuery(api.booking.listPendingCheckouts, {
        eventId: id,
      }) as Promise<Attendee[]>,
      fetchAuthQuery(api.jobs.confirmationByEvent, { eventId: id }),
    ]);
    content = (
      <AdminGuests
        rows={guests.map(adminGuest)}
        pendingRows={pending.map(adminGuest)}
        confirmation={confirmation}
        timezone={event.timezone}
      />
    );
  }
  return (
    <AdminPage
      title={titles[view]}
      description={descriptions[view]}
      actions={
        view === "guests" || view === "leads" ? (
          <a
            className={adminSecondary}
            href={`/api/admin/events/${id}/export?kind=${view}`}
          >
            Export {view === "leads" ? "leads" : "guests"} CSV
          </a>
        ) : undefined
      }
    >
      {content}
    </AdminPage>
  );
}
