import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { fetchAuthQuery } from "@/lib/auth-server";
import { getEvent } from "@/lib/db";
import type { Attendee } from "@/lib/booking";
import { api } from "@/lib/convex";
import {
  FEEDBACK_SENTIMENT_LABELS,
  type FeedbackSentiment,
} from "@/lib/feedback";
import { AdminGuests } from "@/components/admin-guests";
import { Section } from "@/components/ui";

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
  if (!event || !["guests", "leads", "check-in", "feedback"].includes(view))
    notFound();
  const leads: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    marketing_consent: number;
    marketing_consent_at: string | null;
    attribution: string;
    created_at: string;
  }[] =
    view === "leads"
      ? await fetchAuthQuery(api.leads.list, { eventId: id })
      : [];
  const guests: Attendee[] =
    view === "guests" || view === "check-in"
      ? await fetchAuthQuery(api.booking.listGuests, { eventId: id })
      : [];
  const pendingGuests: Attendee[] =
    view === "guests"
      ? await fetchAuthQuery(api.booking.listPendingCheckouts, { eventId: id })
      : [];
  let feedback: FeedbackSummary | null = null;
  if (view === "feedback") {
    feedback = (await fetchAuthQuery(api.feedback.listForEvent, {
      eventId: id,
    })) as FeedbackSummary;
  }
  return (
    <Section>
      <Link href={`/admin/events/${id}`} className="underline">
        ← Event overview
      </Link>
      <h1 className="my-6 text-3xl font-bold">
        {view === "leads"
          ? "Future-event leads"
          : view === "check-in"
            ? "Event-day check-in"
            : view === "feedback"
              ? "Feedback"
              : "Guest list"}
      </h1>
      {view !== "check-in" && view !== "feedback" && (
        <a
          className="inline-block min-h-11 underline"
          href={`/api/admin/events/${id}/export?kind=${view}`}
        >
          Export {view} CSV
        </a>
      )}
      {view === "feedback" && feedback ? (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-white p-5">
              <p className="text-sm">Average rating</p>
              <p className="mt-2 text-3xl font-bold">
                {feedback.average == null ? "—" : `${feedback.average} / 5`}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-5">
              <p className="text-sm">Responses</p>
              <p className="mt-2 text-3xl font-bold">{feedback.count}</p>
            </div>
            <div className="rounded-2xl bg-white p-5">
              <p className="text-sm">Response rate</p>
              <p className="mt-2 text-3xl font-bold">
                {feedback.responseRate == null
                  ? "—"
                  : `${feedback.responseRate}%`}
              </p>
              <p className="mt-1 text-xs text-ink/60">
                of {feedback.eligible} paid guests
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-5">
            <p className="text-sm font-bold">Sentiment</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {(
                Object.keys(feedback.sentimentCounts) as FeedbackSentiment[]
              ).map((key) => (
                <li key={key} className="flex justify-between gap-3 text-sm">
                  <span>{FEEDBACK_SENTIMENT_LABELS[key]}</span>
                  <span className="font-bold">
                    {feedback.sentimentCounts[key]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            {feedback.items.length === 0 && (
              <p>No feedback submitted yet.</p>
            )}
            {feedback.items.map((item) => (
              <article
                key={item.id}
                className="break-words rounded-2xl bg-white p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-bold">
                    {item.firstName} {item.lastName}
                  </h2>
                  <p className="text-sm font-bold">
                    {"★".repeat(item.rating)}
                    <span className="text-ink/30">
                      {"★".repeat(5 - item.rating)}
                    </span>{" "}
                    {item.rating}/5
                  </p>
                </div>
                {item.sentiment && (
                  <p className="mt-2 text-sm">
                    {
                      FEEDBACK_SENTIMENT_LABELS[
                        item.sentiment as FeedbackSentiment
                      ]
                    }
                  </p>
                )}
                {item.enjoyedMost && (
                  <p className="mt-3 text-sm">
                    <span className="font-bold">Enjoyed: </span>
                    {item.enjoyedMost}
                  </p>
                )}
                {item.improvement && (
                  <p className="mt-2 text-sm">
                    <span className="font-bold">Improve: </span>
                    {item.improvement}
                  </p>
                )}
                <p className="mt-3 text-xs text-ink/55">
                  {new Date(item.submittedAt).toLocaleString("en-CA", {
                    timeZone: event.timezone,
                  })}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : view === "leads" ? (
        <div className="space-y-4">
          {leads.length === 0 && <p>No future-event leads yet.</p>}
          {leads.map((r) => (
            <article
              key={String(r.id)}
              className="break-words rounded-2xl bg-white p-5"
            >
              <h2 className="font-bold">
                {String(r.first_name)} {String(r.last_name)}
              </h2>
              <p>{String(r.email)}</p>
              <p>{String(r.phone)}</p>
              <p className="mt-2 text-sm">
                Marketing consent: {r.marketing_consent ? "Yes" : "No"}
              </p>
              <p className="text-xs">{String(r.attribution)}</p>
            </article>
          ))}
        </div>
      ) : (
        <AdminGuests
          rows={guests}
          pendingRows={pendingGuests}
          checkIn={view === "check-in"}
          confirmation={
            view === "guests"
              ? await fetchAuthQuery(api.jobs.confirmationByEvent, {
                  eventId: id,
                })
              : {}
          }
        />
      )}
    </Section>
  );
}
