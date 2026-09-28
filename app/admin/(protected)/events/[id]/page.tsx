import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/lib/convex";
import { Section, Notice, buttonClass } from "@/components/ui";
import { eventDate, type DanceEvent } from "@/lib/event";
export default async function Overview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const data = (await fetchAuthQuery(api.events.overview, {
    eventId: id,
  })) as {
    event: DanceEvent;
    sold: number;
    held: number;
    expected: number;
    checked: number;
    absent: number;
    cancelled: number;
    gross: number;
    net: number;
    leads: number;
    jobs: number;
  } | null;
  if (!data) notFound();
  const event = data.event;
  return (
    <Section>
      <p className="text-sm">{eventDate(event)}</p>
      <h1 className="mt-3 text-3xl font-bold">{event.name}</h1>
      <div className="my-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Tickets sold", `${data.sold} / ${event.capacity}`],
          ["Expected attendees", data.expected],
          ["Checked in", data.checked],
          ["No-shows", data.absent],
          ["Cancelled", data.cancelled],
          ["Gross sales", `$${data.gross / 100} ${event.currency}`],
          [
            "After recorded refunds",
            `$${data.net / 100} ${event.currency}`,
          ],
          ["Future-event leads", data.leads],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl bg-white p-5">
            <p className="text-sm">{label}</p>
            <p className="mt-2 text-3xl font-bold">{String(value)}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {[
          ["guests", "View guests"],
          ["leads", "View leads"],
          ["feedback", "View feedback"],
          ["check-in", "Event-day check-in"],
        ].map(([path, label]) => (
          <Link
            key={path}
            href={`/admin/events/${id}/${path}`}
            className={buttonClass}
          >
            {label}
          </Link>
        ))}
      </div>
      <div className="mt-8 space-y-4">
        <Notice>
          {data.held} checkout holds. {data.jobs} queued or unresolved delivery
          jobs. Cancellation and refunds never reopen inventory.
        </Notice>
        {(!event.waiverText || !process.env.STRIPE_SECRET_KEY) && (
          <Notice>
            Before opening sales: configure Stripe and publish the approved
            waiver using the event configuration script.
          </Notice>
        )}
      </div>
    </Section>
  );
}
