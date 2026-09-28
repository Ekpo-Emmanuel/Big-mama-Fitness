import { notFound } from "next/navigation";
import { getEvent } from "@/lib/db";
import { api, convexClient, withConvex } from "@/lib/convex";
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
  const row =
    token && /^[a-f0-9]{64}$/.test(token)
      ? await withConvex(() =>
          convexClient().query(api.booking.confirmation, {
            token,
            eventId: event.id,
          }),
        )
      : null;
  return (
    <main id="main">
      <ConfirmationRefresh pending={row?.payment_status === "pending"} />
      <ClearActiveRegistration
        eventId={event.id}
        paid={row?.payment_status === "paid"}
      />
      <RegistrationConfirmation event={event} row={row} />
    </main>
  );
}
