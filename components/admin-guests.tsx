"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Search, X } from "lucide-react";
import { MotionValue, useChangeMotion } from "./motion";
import type { Attendee } from "@/lib/booking";
import {
  adminButton,
  adminSecondary,
  Detail,
  EmptyState,
  StatusBadge,
  formatAmount,
  formatDate,
  formatAttribution,
} from "./admin-ui";

export type AdminGuest = Pick<
  Attendee,
  | "id"
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "payment_status"
  | "attendee_status"
  | "inventory_status"
  | "waiver_version"
  | "waiver_text"
  | "waiver_accepted_at"
  | "marketing_consent"
  | "marketing_consent_at"
  | "attribution"
  | "referral_source"
  | "registered_at"
  | "checked_in_at"
  | "amount_paid_cents"
  | "currency"
  | "updated_at"
>;
type Confirmation = Record<
  string,
  { status: string; lastError: string | null }
>;

function actionLabel(action: string, firstName: string, lastName: string) {
  const name = `${firstName} ${lastName}`.trim();
  if (action === "check_in") return `${name} checked in`;
  if (action === "undo_check_in") return `${name}'s check-in was undone`;
  return `${name}: registration updated.`;
}

function actionError(action: string, firstName: string) {
  if (action === "check_in")
    return `Couldn't check ${firstName} in. Try again.`;
  if (action === "undo_check_in")
    return `Couldn't undo ${firstName}'s check-in. Try again.`;
  return "Unable to save. Check your connection and try again.";
}

export function AdminGuests({
  rows,
  pendingRows = [],
  checkIn = false,
  live = false,
  confirmation = {},
  timezone = "America/Vancouver",
  onLiveUpdate,
}: {
  rows: AdminGuest[];
  pendingRows?: AdminGuest[];
  checkIn?: boolean;
  live?: boolean;
  confirmation?: Confirmation;
  timezone?: string;
  onLiveUpdate?: (attendeeId: string, action: string) => Promise<void>;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("paid");
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("");
  const search = useRef<HTMLInputElement>(null);

  // Guests list: soft refresh on focus. Check-in live path uses Convex instead.
  useEffect(() => {
    if (live || checkIn) return;
    const refresh = () => {
      if (document.visibilityState === "visible")
        startRefresh(() => router.refresh());
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [router, live, checkIn]);

  const guests = rows.filter((row) => row.payment_status !== "pending");
  const paid = guests.filter(
    (row) =>
      row.payment_status === "paid" && row.attendee_status !== "cancelled",
  );
  const other = guests.filter((row) => !paid.includes(row));
  const pending = pendingRows.length
    ? pendingRows
    : rows.filter((row) => row.payment_status === "pending");
  const source =
    checkIn || group === "paid" ? paid : group === "pending" ? pending : other;
  const needle = query.trim().toLocaleLowerCase();
  const filtered = source.filter(
    (row) =>
      `${row.first_name} ${row.last_name} ${row.email} ${row.phone}`
        .toLocaleLowerCase()
        .includes(needle) &&
      (filter === "all" ||
        (filter === "checked"
          ? row.attendee_status === "checked_in"
          : ["confirmed", "no_show"].includes(row.attendee_status))),
  );
  const checked = paid.filter(
    (row) => row.attendee_status === "checked_in",
  ).length;

  return (
    <div className="space-y-4">
      {checkIn && (
        <div className="flex items-end justify-between gap-3 rounded-2xl bg-lilac/40 p-4">
          <div>
            <span className="text-2xl font-bold tabular-nums">
              <MotionValue value={checked}>{checked}</MotionValue>{" "}
              <span className="text-base font-normal text-ink/60">
                / {paid.length}
              </span>
            </span>
            <p className="text-xs text-ink/70">guests checked in</p>
          </div>
          {live ? (
            <p className="pb-0.5 text-[11px] font-medium tracking-wide text-ink/50 uppercase">
              Live
            </p>
          ) : (
            <button
              type="button"
              className="text-xs font-semibold text-ink/55 underline-offset-2 hover:underline"
              onClick={() => startRefresh(() => router.refresh())}
              disabled={refreshing}
            >
              {refreshing ? "Reloading…" : "Reload"}
            </button>
          )}
        </div>
      )}
      <div className="sticky top-0 z-10 space-y-3 bg-cream py-3">
        {!checkIn && (
          <div
            className="grid grid-cols-3 gap-1 rounded-xl bg-ink/5 p-1"
            aria-label="Registration groups"
          >
            {[
              ["paid", `Guests (${paid.length})`],
              ["pending", `Incomplete (${pending.length})`],
              ["other", `Cancelled / refunded (${other.length})`],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={group === value}
                onClick={() => {
                  setGroup(value);
                  setFilter("all");
                }}
                className={`motion-press min-h-12 rounded-lg px-2 py-2 text-xs font-semibold sm:text-sm ${group === value ? "bg-white shadow-sm" : "hover:bg-white/60"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="relative">
          <Search
            aria-hidden="true"
            size={18}
            className="absolute top-4 left-3 text-ink/60"
          />
          <label htmlFor="guest-search" className="sr-only">
            Search guests by name, email or phone
          </label>
          <input
            ref={search}
            id="guest-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email or phone"
            className="min-h-12 w-full rounded-xl border border-ink/25 bg-white py-3 pr-12 pl-10 text-base focus:outline-2 focus:outline-ink"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute top-0 right-0 flex h-12 w-11 items-center justify-center"
              onClick={() => {
                setQuery("");
                search.current?.focus();
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>
        {(checkIn || group === "paid") && (
          <div className="flex flex-wrap gap-2" aria-label="Check-in filters">
            {(
              [
                ["all", `All (${paid.length})`],
                ["waiting", `Not checked in (${paid.length - checked})`],
                ["checked", `Checked in (${checked})`],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`motion-press min-h-11 rounded-lg px-3 text-xs font-semibold ${filter === value ? "bg-ink text-white" : "bg-white ring-1 ring-inset ring-ink/15"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <p
        role="status"
        className={
          message ? "text-sm font-semibold text-emerald-900" : "sr-only"
        }
      >
        <MotionValue value={message}>{message}</MotionValue>
      </p>
      {!checkIn && group === "pending" && (
        <p className="rounded-xl bg-sun/25 p-4 text-sm leading-relaxed">
          These checkouts are incomplete. No ticket is confirmed until payment
          succeeds. Expired holds do not reserve a place.
        </p>
      )}
      <p className="text-xs text-ink/65">
        {filtered.length}{" "}
        {filtered.length === 1 ? "registration" : "registrations"}
        {query ? " matching your search" : ""}
      </p>
      {filtered.length === 0 ? (
        <EmptyState
          title={
            query
              ? "No matching guests"
              : group === "pending"
                ? "No incomplete registrations"
                : filter !== "all"
                  ? "No guests in this view"
                  : "No guests yet"
          }
        >
          {query
            ? "Try another name, email address or phone number."
            : "Registrations appear here as their status changes."}
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => (
            <GuestCard
              key={row.id}
              row={row}
              checkIn={checkIn}
              confirmation={confirmation}
              timezone={timezone}
              onSuccess={setMessage}
              onLiveUpdate={onLiveUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GuestCard({
  row,
  checkIn,
  confirmation,
  timezone,
  onSuccess,
  onLiveUpdate,
}: {
  row: AdminGuest;
  checkIn: boolean;
  confirmation: Confirmation;
  timezone: string;
  onSuccess: (value: string) => void;
  onLiveUpdate?: (attendeeId: string, action: string) => Promise<void>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLElement>(null);
  useChangeMotion(card, row.attendee_status);
  const locked = useRef(false);
  const [refreshing, startRefresh] = useTransition();
  const pending = row.payment_status === "pending";
  const checkedIn = row.attendee_status === "checked_in";
  const canCheckIn =
    row.payment_status === "paid" &&
    ["confirmed", "no_show"].includes(row.attendee_status);
  const canUndo =
    checkIn &&
    row.payment_status === "paid" &&
    row.attendee_status === "checked_in";

  async function update(action: string) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      if (onLiveUpdate) {
        await onLiveUpdate(row.id, action);
      } else {
        const response = await fetch(`/api/admin/attendees/${row.id}`, {
          method: "POST",
          headers: { Accept: "application/json" },
          body: new URLSearchParams({
            action,
            view: checkIn ? "check-in" : "guests",
          }),
        });
        const result = await response.json();
        if (!response.ok || result.ok !== true)
          throw new Error(
            result.error || "Unable to save. Refresh and try again.",
          );
        startRefresh(() => router.refresh());
      }
      dialog.current?.close();
      onSuccess(actionLabel(action, row.first_name, row.last_name));
    } catch {
      setError(actionError(action, row.first_name));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  return (
    <article
      ref={card}
      className={`motion-state min-w-0 rounded-2xl border p-4 sm:p-5 ${checkedIn ? "border-emerald-800/20 bg-emerald-50/40" : "border-ink/10 bg-white"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-40">
          <h2 className="font-semibold [overflow-wrap:anywhere]">
            {row.first_name} {row.last_name}
          </h2>
          <p className="mt-1 text-xs text-ink/65 [overflow-wrap:anywhere]">
            {row.email}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge status={row.payment_status} />
            {!pending && <StatusBadge status={row.attendee_status} />}
            <StatusBadge
              status={row.waiver_accepted_at ? "accepted" : "missing"}
            />
            {pending && <StatusBadge status={row.inventory_status} />}
          </div>
        </div>
        {canCheckIn && (
          <button
            type="button"
            className={`${adminButton} shrink-0`}
            disabled={busy || refreshing}
            onClick={() => update("check_in")}
          >
            <Check size={17} aria-hidden="true" />
            {busy || refreshing ? "Saving…" : "Check in"}
          </button>
        )}
        {canUndo && (
          <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-900">
              <Check size={16} aria-hidden="true" />
              Checked in
            </p>
            <button
              type="button"
              className="motion-press min-h-9 px-1 text-xs font-medium text-ink/50 underline-offset-2 hover:text-ink hover:underline disabled:opacity-50"
              disabled={busy}
              onClick={() => update("undo_check_in")}
            >
              {busy ? "Undoing…" : "Undo check-in"}
            </button>
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <details className="motion-disclosure mt-3 border-t border-ink/10 pt-1">
        <summary className="min-h-11 cursor-pointer py-3 text-xs font-semibold focus-visible:outline-2">
          Guest details
        </summary>
        <div className="space-y-5 pb-2">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="Email">
              <a className="underline" href={`mailto:${row.email}`}>
                {row.email}
              </a>
            </Detail>
            <Detail label="Phone">
              <a className="underline" href={`tel:${row.phone}`}>
                {row.phone}
              </a>
            </Detail>
            <Detail label="Registered">
              {formatDate(row.registered_at, timezone)}
            </Detail>
            <Detail label="Checked in">
              {row.checked_in_at
                ? formatDate(row.checked_in_at, timezone)
                : "Not checked in"}
            </Detail>
            <Detail label="Payment">
              {pending
                ? "Payment incomplete — no confirmed ticket"
                : `${formatAmount(row.amount_paid_cents, row.currency)} ${row.currency.toUpperCase()} · ${row.payment_status}`}
            </Detail>
            {!checkIn && !pending && (
              <Detail label="Confirmation email">
                {confirmation[row.id]?.status === "sent"
                  ? "Sent"
                  : confirmation[row.id]?.status === "needs_review" ||
                      confirmation[row.id]?.lastError
                    ? "Needs attention"
                    : "Not yet sent"}
              </Detail>
            )}
          </dl>
          <details className="motion-disclosure rounded-xl bg-cream p-3">
            <summary className="cursor-pointer py-2 text-sm font-semibold">
              Waiver {row.waiver_accepted_at ? "accepted" : "not recorded"}
            </summary>
            <p className="mt-2 text-xs text-ink/65">
              {row.waiver_version} ·{" "}
              {formatDate(row.waiver_accepted_at, timezone)}
            </p>
            <p className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">
              {row.waiver_text || "No waiver snapshot recorded."}
            </p>
          </details>
          <details className="motion-disclosure">
            <summary className="cursor-pointer py-3 text-xs font-semibold">
              Consent & referral
            </summary>
            <dl className="mt-2 grid gap-4 sm:grid-cols-2">
              <Detail label="Marketing consent">
                {row.marketing_consent
                  ? `Yes · ${formatDate(row.marketing_consent_at, timezone)}`
                  : "No"}
              </Detail>
              <Detail label="How they found us">
                {row.referral_source || formatAttribution(row.attribution)}
              </Detail>
            </dl>
          </details>
          {!checkIn && row.payment_status === "paid" && (
            <div className="border-t border-ink/10 pt-4">
              <h3 className="text-xs font-semibold">Manage registration</h3>
              <p className="mt-2 text-xs leading-relaxed text-ink/65">
                Cancellation and recorded refunds do not reopen a seat. Record a
                refund only after issuing it in Stripe.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
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
                    <button
                      type="button"
                      key={action}
                      disabled={busy || refreshing}
                      className={adminSecondary}
                      onClick={() => {
                        setConfirmAction(action);
                        dialog.current?.showModal();
                      }}
                    >
                      {label}
                    </button>
                  ))}
                {confirmation[row.id]?.status === "needs_review" && (
                  <button
                    type="button"
                    className={adminSecondary}
                    disabled={busy || refreshing}
                    onClick={() => update("resend_confirmation")}
                  >
                    Resend confirmation email
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </details>
      <dialog
        ref={dialog}
        aria-labelledby={`action-${row.id}`}
        className="motion-dialog fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl bg-cream p-5 text-ink shadow-xl backdrop:bg-ink/40"
      >
        <h2 id={`action-${row.id}`} className="text-xl font-bold">
          {confirmAction === "record_refund"
            ? "Record completed refund?"
            : confirmAction === "no_show"
              ? "Mark guest as no-show?"
              : "Cancel this registration?"}
        </h2>
        <p className="mt-3 text-sm leading-relaxed [overflow-wrap:anywhere]">
          {row.first_name} {row.last_name}.{" "}
          {confirmAction === "record_refund"
            ? "This records a refund already issued in Stripe. It does not send money or reopen a seat."
            : confirmAction === "no_show"
              ? "This guest will be marked absent. You can still check them in if they arrive later."
              : "This cancels attendance and scheduled guest emails. It does not issue a refund or reopen a seat."}
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-800">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            autoFocus
            disabled={busy}
            className={adminSecondary}
            onClick={() => {
              dialog.current?.close();
            }}
          >
            Keep registration
          </button>
          <button
            type="button"
            disabled={busy}
            className={adminButton}
            onClick={() => confirmAction && update(confirmAction)}
          >
            {busy ? "Saving…" : "Confirm change"}
          </button>
        </div>
      </dialog>
    </article>
  );
}
