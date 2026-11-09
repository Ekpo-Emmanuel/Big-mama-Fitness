import { notFound } from "next/navigation";
import { getEvent } from "@/lib/db";
import { loadConfirmation } from "@/lib/booking";
import { confirmPaidCheckout } from "@/lib/confirm-checkout";
import { RegistrationConfirmation } from "@/components/registration-confirmation";
import { ConfirmationRefresh } from "@/components/confirmation-refresh";
import { ClearActiveRegistration } from "@/components/clear-active-registration";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your registration",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default async function Success({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const event = await getEvent((await params).slug);
  if (!event) notFound();
  const { token } = await searchParams;
  let row =
    token && /^[a-f0-9]{64}$/.test(token)
      ? await loadConfirmation(token, event.id)
      : null;
  if (row?.payment_status === "pending") {
    try {
      row = await confirmPaidCheckout(row);
    } catch {
      // Webhook may still complete it; keep polling.
    }
    if (row.payment_status === "pending") {
      row = (await loadConfirmation(token!, event.id)) ?? row;
    }
  }
  const displayEvent =
    row?.event_id && row.event_id !== event.id
      ? ((await getEvent(row.event_id)) ?? event)
      : event;
  const pending = row?.payment_status === "pending";
  return (
    <main id="main">
      <ConfirmationRefresh pending={pending} />
      <ClearActiveRegistration
        eventId={displayEvent.id}
        paid={row?.payment_status === "paid"}
      />
      <RegistrationConfirmation event={displayEvent} row={row} />
    </main>
  );
}
