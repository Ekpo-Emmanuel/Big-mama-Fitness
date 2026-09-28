"use client";
import { useState, type FormEvent } from "react";
import { buttonClass, inputClass, Notice } from "./ui";
import { getAttribution } from "@/lib/attribution";
import { trackEvent } from "@/lib/analytics";
export function FutureEventLeadForm({ eventId }: { eventId: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
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
          firstName: data.get("firstName"),
          lastName: data.get("lastName"),
          email: data.get("email"),
          phone: data.get("phone"),
          marketingConsent: data.get("marketingConsent") === "on",
          attribution: getAttribution(),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      trackEvent("future_event_lead_submit", { event_id: eventId });
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <Notice>
        Your interest has been saved. We’ll email about future classes only if
        you selected email updates.
      </Notice>
    );
  return (
    <form onSubmit={submit} className="mt-6 max-w-2xl space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        {[
          ["firstName", "First name", "given-name"],
          ["lastName", "Last name", "family-name"],
          ["email", "Email", "email"],
          ["phone", "Phone", "tel"],
        ].map(([name, label, auto]) => (
          <label key={name} className="text-sm font-bold">
            {label}
            <input
              required
              name={name}
              autoComplete={auto}
              type={
                auto === "email" ? "email" : auto === "tel" ? "tel" : "text"
              }
              maxLength={auto === "email" ? 254 : 80}
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
        Yes, email me about future classes. This is optional, and I can
        unsubscribe.
      </label>
      <p className="text-sm">
        This is a future-event list. It does not reserve a cancelled ticket for
        this class.
      </p>
      {error && (
        <p role="alert" className="motion-enter text-red-800">
          {error}
        </p>
      )}
      <button disabled={busy} aria-busy={busy} className={buttonClass}>
        {busy ? "Saving…" : "Notify Me About the Next Class"}
      </button>
    </form>
  );
}
