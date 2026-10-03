"use client";
import { useId, useState, type FormEvent } from "react";
import { Check, ArrowRight } from "lucide-react";
import { buttonClass, inputClass } from "./ui";
import { getAttribution } from "@/lib/attribution";
import { trackEvent } from "@/lib/analytics";
import type { LeadContext } from "@/lib/validation";

export function FutureEventLeadForm({
  eventId,
  sourceContext,
}: {
  eventId: string;
  sourceContext: LeadContext;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [emailUpdates, setEmailUpdates] = useState(false);
  const errorId = useId();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      const response = await fetch(`/api/events/${eventId}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: String(data.get("firstName") || ""),
          lastName: String(data.get("lastName") || ""),
          email: String(data.get("email") || ""),
          phone: String(data.get("phone") || ""),
          marketingConsent: data.get("marketingConsent") === "on",
          attribution: getAttribution(),
          sourceContext,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      trackEvent("future_event_lead_submit", {
        event_id: eventId,
        lead_context: sourceContext,
      });
      setEmailUpdates(data.get("marketingConsent") === "on");
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <div role="status" className="motion-enter py-5 sm:py-8">
        <span className="mb-5 inline-flex size-12 items-center justify-center rounded-full bg-sun">
          <Check size={24} aria-hidden="true" />
        </span>
        <h3 className="font-display text-4xl leading-[1.05] uppercase">
          You’re on the list.
        </h3>
        <p className="mt-4 max-w-sm text-base leading-relaxed">
          {emailUpdates
            ? "We’ll email you when the next Big Mama Fitness class is announced. See you on the dance floor."
            : "Your interest is saved. Check back here for the next Big Mama Fitness date."}
        </p>
        <p className="mt-5 border-t border-ink/15 pt-4 text-xs leading-relaxed text-ink/65">
          This is your next-class list confirmation, not a ticket or seat
          reservation.
        </p>
      </div>
    );
  return (
    <form
      onSubmit={submit}
      aria-labelledby="next-class-heading"
      aria-describedby={error ? errorId : undefined}
      className="space-y-5"
    >
      <div className="space-y-4">
        {[
          ["firstName", "First name", "given-name"],
          ["email", "Email", "email"],
        ].map(([name, label, auto]) => (
          <label key={name} className="block text-sm font-semibold">
            {label}
            <input
              required
              name={name}
              autoComplete={auto}
              type={auto === "email" ? "email" : "text"}
              maxLength={auto === "email" ? 254 : 80}
              spellCheck={auto === "email" ? false : undefined}
              autoCapitalize={auto === "email" ? "none" : "words"}
              className={inputClass}
            />
          </label>
        ))}
      </div>
      <label className="flex min-h-12 items-start gap-3 text-sm leading-relaxed">
        <input
          name="marketingConsent"
          type="checkbox"
          className="mt-1 size-5 shrink-0 accent-ink"
        />
        <span>
          Yes, email me about future classes.
          <span className="mt-1 block text-xs text-ink/65">
            Optional. Unsubscribe any time.
          </span>
        </span>
      </label>
      {error && (
        <p
          id={errorId}
          role="alert"
          className="motion-enter rounded-xl border border-red-800/20 bg-red-50 p-3 text-sm leading-relaxed text-red-900"
        >
          {error}
        </p>
      )}
      <button
        disabled={busy}
        aria-busy={busy}
        className={`${buttonClass} w-full`}
      >
        <span>
          {busy
            ? "Adding you to the list…"
            : sourceContext === "cant_make_current_date"
              ? "Notify Me About the Next Class"
              : "Join the Next Class List"}
        </span>
        {!busy && <ArrowRight className="size-4 shrink-0" aria-hidden="true" />}
      </button>
      <p className="text-xs leading-relaxed text-ink/65">
        Joining does not reserve a seat or guarantee a future ticket. You choose
        whether to book when a new date opens.
      </p>
    </form>
  );
}
