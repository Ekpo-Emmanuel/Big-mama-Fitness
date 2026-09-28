import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/lib/convex";
import {
  eventDateFull,
  eventTime,
  eventState,
  type DanceEvent,
} from "@/lib/event";
import {
  AdminPage,
  Metric,
  StatusBadge,
  adminButton,
  adminSecondary,
  adminPanel,
  formatAmount,
} from "@/components/admin-ui";
export default async function Overview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [data, pending, feedback] = await Promise.all([
    fetchAuthQuery(api.events.overview, { eventId: id }) as Promise<
      FunctionReturnType<typeof api.events.overview>
    >,
    fetchAuthQuery(api.booking.listPendingCheckouts, {
      eventId: id,
    }) as Promise<FunctionReturnType<typeof api.booking.listPendingCheckouts>>,
    fetchAuthQuery(api.feedback.listForEvent, { eventId: id }) as Promise<
      FunctionReturnType<typeof api.feedback.listForEvent>
    >,
  ]);
  if (!data) notFound();
  const event: DanceEvent = data.event;
  const root = `/admin/events/${id}`;
  const remaining = Math.max(0, event.capacity - data.sold - data.held);
  return (
    <AdminPage
      title="Event overview"
      description={`${eventDateFull(event)} · ${eventTime(event)}–${eventTime(event, event.endsAt)}`}
      actions={
        <Link href={`${root}/check-in`} className={adminButton}>
          Start check-in
        </Link>
      }
    >
      <div className="mb-5 rounded-2xl bg-lilac/40 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-ink/70">Event summary</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
              {event.name}
            </h2>
            <p className="mt-2 text-sm text-ink/70">
              {event.venueName || event.addressLine1} · {event.city}
            </p>
          </div>
          <StatusBadge status={eventState(event, data.sold)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label="Tickets sold"
          value={`${data.sold} / ${event.capacity}`}
          detail={`${remaining} spots available · ${data.held} active holds`}
        />
        <Metric
          label="Revenue"
          value={formatAmount(data.net, event.currency)}
          detail={`${event.currency} · after recorded refunds`}
        />
        <Metric
          label="Expected guests"
          value={data.expected}
          detail="Paid, confirmed or checked in"
        />
        <Metric
          label="Checked in"
          value={data.checked}
          detail="Arrivals recorded by your team"
        />
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className={adminPanel}>
          <h2 className="text-lg font-semibold">Ready for your guests</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink/70">
            Find a guest, check their registration and welcome them in. Your
            organizers share the same guest list.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link className={adminButton} href={`${root}/guests`}>
              View guests
            </Link>
            <a
              className={adminSecondary}
              href={`/api/admin/events/${id}/export?kind=guests`}
            >
              Export guests CSV
            </a>
          </div>
          <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-ink/10 pt-5">
            {[
              ["Incomplete", pending.length],
              ["Cancelled", data.cancelled],
              ["No-shows", data.absent],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-ink/65">{label}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <section className={adminPanel}>
          <h2 className="text-lg font-semibold">Keep the connection</h2>
          <Link
            href={`${root}/feedback`}
            className="mt-4 flex min-h-16 items-center justify-between gap-3 border-b border-ink/10 py-3 text-sm"
          >
            <span>Feedback responses</span>
            <span className="text-xl font-semibold tabular-nums">
              {feedback.count} <span aria-hidden="true">›</span>
            </span>
          </Link>
          <Link
            href={`${root}/leads`}
            className="flex min-h-16 items-center justify-between gap-3 py-3 text-sm"
          >
            <span>Future-event leads</span>
            <span className="text-xl font-semibold tabular-nums">
              {data.leads} <span aria-hidden="true">›</span>
            </span>
          </Link>
          <p className="mt-2 text-xs leading-relaxed text-ink/65">
            Interest in future classes. This is not a cancellation waitlist.
          </p>
        </section>
      </div>
      <details className="mt-6 rounded-xl border border-ink/15 px-4">
        <summary className="cursor-pointer py-4 text-sm font-semibold">
          Sales & communication notes
        </summary>
        <div className="space-y-3 pb-4 text-sm leading-relaxed text-ink/70">
          <p>
            Gross sales: {formatAmount(data.gross, event.currency)}{" "}
            {event.currency}. Cancelled and refunded tickets do not reopen
            inventory.
          </p>
          <p>
            {data.jobs} queued or unresolved email deliveries across all events.
            This includes scheduled messages; it is not a count of failed
            emails. Individual confirmation status appears in guest details.
          </p>
          {(!event.waiverText || !process.env.STRIPE_SECRET_KEY) && (
            <p className="text-amber-900">
              Sales setup needs attention. Ask your site administrator to verify
              payment setup and the approved waiver before opening registration.
            </p>
          )}
          <Link
            className="inline-flex min-h-11 items-center font-semibold underline"
            href={`${root}/details`}
          >
            View event details
          </Link>
        </div>
      </details>
    </AdminPage>
  );
}
