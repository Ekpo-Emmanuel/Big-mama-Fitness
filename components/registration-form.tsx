"use client";
import { useState, useRef, useEffect, type FormEvent } from "react";
import { getAttribution } from "@/lib/attribution";
import {
  checkoutRequestKey,
  clearActiveRegistration,
  isRegistrationCompleteError,
  registrationDraftKey,
} from "@/lib/checkout-attempt";
import { trackEvent } from "@/lib/analytics";
import type { DanceEvent } from "@/lib/event";
import { eventPurchaseFingerprint } from "@/lib/event-purchase";
import { buttonClass, inputClass, Notice } from "./ui";
import { WaiverAcceptance } from "./waiver-dialog";

const draftFields = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "referralSource",
] as const;

export function RegistrationForm({
  event,
  ready,
}: {
  event: DanceEvent;
  ready: boolean;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fingerprint = eventPurchaseFingerprint(event);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    try {
      const activeKey = checkoutRequestKey(event.id);
      const raw = sessionStorage.getItem(registrationDraftKey(event.id));
      if (!raw) return;
      const draft = JSON.parse(raw) as Record<string, string>;
      // Only restore drafts tied to the current ACTIVE requestKey.
      if (draft.requestKey && draft.requestKey !== activeKey) {
        sessionStorage.removeItem(registrationDraftKey(event.id));
        return;
      }
      for (const name of draftFields) {
        const input = form.elements.namedItem(name);
        if (input instanceof HTMLInputElement && draft[name])
          input.value = draft[name];
      }
      const marketing = form.elements.namedItem("marketingConsent");
      if (marketing instanceof HTMLInputElement && draft.marketingConsent === "1")
        marketing.checked = true;
    } catch {}
  }, [event.id]);

  function saveDraft(form: HTMLFormElement, requestKey: string) {
    const draft: Record<string, string> = { requestKey };
    for (const name of draftFields) {
      const input = form.elements.namedItem(name);
      if (input instanceof HTMLInputElement) draft[name] = input.value;
    }
    const marketing = form.elements.namedItem("marketingConsent");
    draft.marketingConsent =
      marketing instanceof HTMLInputElement && marketing.checked ? "1" : "0";
    try {
      sessionStorage.setItem(
        registrationDraftKey(event.id),
        JSON.stringify(draft),
      );
    } catch {}
  }

  async function startCheckout(form: HTMLFormElement, allowCompleteRetry: boolean) {
    const data = new FormData(form);
    const requestKey = checkoutRequestKey(event.id);
    saveDraft(form, requestKey);
    trackEvent("registration_submit", { event_id: event.id });
    const response = await fetch(`/api/events/${event.id}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: data.get("firstName"),
        lastName: data.get("lastName"),
        email: data.get("email"),
        phone: data.get("phone"),
        referralSource: data.get("referralSource"),
        waiverAccepted: data.get("waiverAccepted") === "on",
        waiverVersion: event.waiverVersion,
        marketingConsent: data.get("marketingConsent") === "on",
        requestKey,
        purchaseFingerprint: fingerprint,
        attribution: getAttribution(),
      }),
    });
    const result = (await response.json()) as { error?: string; url?: string };
    if (!response.ok) {
      const message =
        result.error || "Checkout could not start. Please try again.";
      // Paid intent reused: rotate key once and start a fresh registration.
      if (
        allowCompleteRetry &&
        response.status === 409 &&
        isRegistrationCompleteError(message)
      ) {
        clearActiveRegistration(event.id);
        return startCheckout(form, false);
      }
      // Keep ACTIVE unpaid requestKey on other conflicts (cancel/retry path).
      throw new Error(message);
    }
    if (!result.url) throw new Error("Checkout could not start. Please try again.");
    trackEvent("checkout_start", {
      event_id: event.id,
      ticket_price: event.priceCents / 100,
      currency: event.currency,
    });
    window.location.assign(result.url);
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const form = e.currentTarget;
    try {
      await startCheckout(form, true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Connection interrupted. Please try again.",
      );
      setBusy(false);
    }
  }
  return (
    <form
      ref={formRef}
      onFocus={() => {
        if (!started.current) {
          started.current = true;
          trackEvent("registration_start", { event_id: event.id });
        }
      }}
      onSubmit={submit}
      className="space-y-5"
    >
      {!ready && (
        <Notice>Booking is not open yet. Please check back soon.</Notice>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        {[
          ["firstName", "First name", "given-name"],
          ["lastName", "Last name", "family-name"],
          ["email", "Email", "email"],
          ["phone", "Phone", "tel"],
        ].map(([name, label, autocomplete]) => (
          <label key={name} className="text-sm font-bold">
            {label}
            <input
              required
              name={name}
              autoComplete={autocomplete}
              type={
                name === "email" ? "email" : name === "phone" ? "tel" : "text"
              }
              maxLength={name === "email" ? 254 : 80}
              className={inputClass}
            />
          </label>
        ))}
      </div>
      <label className="block text-sm font-bold">
        How did you hear about us?{" "}
        <span className="font-normal">(optional)</span>
        <input name="referralSource" maxLength={120} className={inputClass} />
      </label>
      {event.waiverText ? (
        <WaiverAcceptance
          text={event.waiverText}
          version={event.waiverVersion}
        />
      ) : (
        <label className="flex min-h-12 items-start gap-3 text-sm leading-relaxed">
          <input
            name="waiverAccepted"
            type="checkbox"
            required
            className="mt-1 size-5 shrink-0 accent-ink"
          />
          I have read and agree to the Participation Waiver and Assumption of
          Risk.
        </label>
      )}
      <label className="flex min-h-12 items-start gap-3 text-sm leading-relaxed">
        <input
          name="marketingConsent"
          type="checkbox"
          className="mt-1 size-5 shrink-0 accent-ink"
        />
        Email me about future classes. (Optional — you can book without this.)
      </label>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-700 bg-red-50 p-4 text-red-900"
        >
          {error}
        </p>
      )}
      <button disabled={!ready || busy} className={`${buttonClass} w-full`}>
        {busy ? "Opening secure checkout…" : "Continue to secure checkout"}
      </button>
      <p className="text-center text-xs leading-relaxed">
        Your spot is confirmed after successful payment. Your details are used
        for registration and event updates. Future-class emails are optional.
      </p>
    </form>
  );
}
