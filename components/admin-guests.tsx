import type { Attendee } from "@/lib/booking";
import { buttonClass } from "./ui";

function confirmationLabel(row?: { status: string; lastError: string | null }) {
  if (!row) return "Not sent";
  if (row.status === "sent") return "Sent";
  if (row.status === "needs_review" || row.lastError) return "Failed";
  return "Not sent";
}

function isIncompleteCheckout(row: Attendee) {
  return row.payment_status === "pending";
}

export function AdminGuests({
  rows,
  pendingRows = [],
  checkIn = false,
  confirmation = {},
}: {
  rows: Attendee[];
  pendingRows?: Attendee[];
  checkIn?: boolean;
  confirmation?: Record<string, { status: string; lastError: string | null }>;
}) {
  const guests = rows.filter((row) => !isIncompleteCheckout(row));
  const pending = pendingRows.length
    ? pendingRows
    : rows.filter(isIncompleteCheckout);

  return (
    <div className="mt-6 space-y-8">
      <section className="space-y-4">
        {guests.length === 0 && (
          <p>No registrations yet. Paid guests will appear here.</p>
        )}
        {guests.map((row) => (
          <GuestCard
            key={row.id}
            row={row}
            checkIn={checkIn}
            confirmation={confirmation}
          />
        ))}
      </section>
      {!checkIn && pending.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold">
            Pending / incomplete registrations
          </h2>
          <p className="text-sm">
            Abandoned or in-progress Stripe checkouts. Not confirmed guests.
          </p>
          {pending.map((row) => (
            <GuestCard
              key={row.id}
              row={row}
              checkIn={false}
              confirmation={confirmation}
              pending
            />
          ))}
        </section>
      )}
    </div>
  );
}

function GuestCard({
  row,
  checkIn,
  confirmation,
  pending = false,
}: {
  row: Attendee;
  checkIn: boolean;
  confirmation: Record<string, { status: string; lastError: string | null }>;
  pending?: boolean;
}) {
  return (
    <article
      className={`rounded-2xl border p-5 ${
        pending
          ? "border-dashed border-ink/30 bg-white/70"
          : "border-ink/20 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">
            {row.first_name} {row.last_name}
          </h2>
          <p className="mt-1 text-sm">
            {row.attendee_status.replaceAll("_", " ")} · Payment:{" "}
            {row.payment_status}
            {pending ? ` · Hold: ${row.inventory_status}` : ""}
          </p>
          {!checkIn && !pending && (
            <p className="mt-1 text-sm">
              Confirmation email: {confirmationLabel(confirmation[row.id])}
            </p>
          )}
        </div>
        {row.payment_status === "paid" &&
          ["confirmed", "no_show"].includes(row.attendee_status) && (
            <form action={`/api/admin/attendees/${row.id}`} method="post">
              <input type="hidden" name="action" value="check_in" />
              <input
                type="hidden"
                name="view"
                value={checkIn ? "check-in" : "guests"}
              />
              <button className={buttonClass}>Check in</button>
            </form>
          )}
      </div>
      {!checkIn && (
        <details className="mt-4">
          <summary className="cursor-pointer py-2 font-bold">
            Contact, waiver, and ticket details
          </summary>
          <dl className="my-4 space-y-2 break-words text-sm">
            <div>
              <dt className="font-bold">Email / phone</dt>
              <dd>
                {row.email} · {row.phone}
              </dd>
            </div>
            <div>
              <dt className="font-bold">Waiver accepted</dt>
              <dd>
                {row.waiver_version} · {row.waiver_accepted_at}
              </dd>
              <dd className="mt-2 whitespace-pre-wrap">{row.waiver_text}</dd>
            </div>
            <div>
              <dt className="font-bold">Marketing consent</dt>
              <dd>
                {row.marketing_consent ? "Yes" : "No"}{" "}
                {row.marketing_consent_at}
              </dd>
            </div>
            <div>
              <dt className="font-bold">Registered / checked in</dt>
              <dd>
                {row.registered_at} / {row.checked_in_at || "Not checked in"}
              </dd>
            </div>
            <div>
              <dt className="font-bold">Attribution / referral</dt>
              <dd>
                {row.attribution} / {row.referral_source || "Not provided"}
              </dd>
            </div>
          </dl>
          {row.payment_status === "paid" && (
            <div className="flex flex-wrap gap-3">
              {[
                ["cancel", "Mark cancelled"],
                ["no_show", "Mark no-show"],
                ["record_refund", "Record completed refund"],
              ]
                .filter(
                  ([action]) =>
                    action !== "no_show" ||
                    row.attendee_status === "confirmed",
                )
                .map(([action, label]) => (
                  <form
                    key={action}
                    action={`/api/admin/attendees/${row.id}`}
                    method="post"
                  >
                    <input type="hidden" name="action" value={action} />
                    <button className="min-h-11 rounded-lg border border-ink/30 px-4 text-sm">
                      {label}
                    </button>
                  </form>
                ))}
              {confirmation[row.id]?.status === "needs_review" && (
                <form
                  action={`/api/admin/attendees/${row.id}`}
                  method="post"
                >
                  <input
                    type="hidden"
                    name="action"
                    value="resend_confirmation"
                  />
                  <button className="min-h-11 rounded-lg border border-ink/30 px-4 text-sm">
                    Resend confirmation email
                  </button>
                </form>
              )}
            </div>
          )}
          <p className="mt-3 text-xs">
            “Record completed refund” records a refund already issued in
            Stripe. It does not send money or reopen a seat.
          </p>
        </details>
      )}
    </article>
  );
}
