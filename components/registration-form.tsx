"use client";
import {
  useState,
  useRef,
  useEffect,
  useId,
  type FormEvent,
  type FocusEvent,
} from "react";
import { getAttribution } from "@/lib/attribution";
import {
  adoptCheckoutRequestKey,
  checkoutRequestKey,
  clearActiveRegistration,
  isRegistrationCompleteError,
  registrationDraftKey,
  REQUEST_KEY_QUERY,
} from "@/lib/checkout-attempt";
import { trackEvent } from "@/lib/analytics";
import { money, type DanceEvent } from "@/lib/event";
import { eventPurchaseFingerprint } from "@/lib/event-purchase";
import { registrationFormSchema } from "@/lib/validation";
import { buttonClass, inputClass, inputErrorClass, Notice } from "./ui";
import { WaiverAcceptance } from "./waiver-dialog";
import { LoaderCircle } from "lucide-react";

const draftFields = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "referralSource",
] as const;

type FieldName =
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "referralSource"
  | "waiverAccepted";

const fieldOrder: FieldName[] = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "referralSource",
  "waiverAccepted",
];

const textFields = [
  {
    name: "firstName" as const,
    label: "First name",
    autocomplete: "given-name",
    type: "text" as const,
    maxLength: 80,
  },
  {
    name: "lastName" as const,
    label: "Last name",
    autocomplete: "family-name",
    type: "text" as const,
    maxLength: 80,
  },
  {
    name: "email" as const,
    label: "Email",
    autocomplete: "email",
    type: "email" as const,
    maxLength: 254,
  },
  {
    name: "phone" as const,
    label: "Phone",
    autocomplete: "tel",
    type: "tel" as const,
    maxLength: 25,
  },
];

function readFormValues(form: HTMLFormElement) {
  const data = new FormData(form);
  return {
    firstName: String(data.get("firstName") ?? ""),
    lastName: String(data.get("lastName") ?? ""),
    email: String(data.get("email") ?? ""),
    phone: String(data.get("phone") ?? ""),
    referralSource: String(data.get("referralSource") ?? ""),
    waiverAccepted: data.get("waiverAccepted") === "on",
    marketingConsent: data.get("marketingConsent") === "on",
  };
}

function issuesToFieldErrors(
  issues: { path: PropertyKey[]; message: string }[],
): Partial<Record<FieldName, string>> {
  const next: Partial<Record<FieldName, string>> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (
      typeof key === "string" &&
      fieldOrder.includes(key as FieldName) &&
      !next[key as FieldName]
    ) {
      next[key as FieldName] = issue.message;
    }
  }
  return next;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm font-normal text-red-800">
      {message}
    </p>
  );
}

export function RegistrationForm({
  event,
  ready,
}: {
  event: DanceEvent;
  ready: boolean;
}) {
  const formErrorId = useId();
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<FieldName, string>>
  >({});
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const attempted = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fingerprint = eventPurchaseFingerprint(event);
  const errorCount = Object.keys(fieldErrors).length;

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    try {
      // Stripe cancel_url returns ?rk= — adopt before reading sessionStorage.
      const params = new URLSearchParams(window.location.search);
      const fromCancel = params.get(REQUEST_KEY_QUERY);
      if (fromCancel) adoptCheckoutRequestKey(event.id, fromCancel);

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
      if (
        marketing instanceof HTMLInputElement &&
        draft.marketingConsent === "1"
      )
        marketing.checked = true;
    } catch {}
  }, [event.id]);

  function clearFieldError(name: FieldName) {
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  function validateAll(form: HTMLFormElement) {
    attempted.current = true;
    const parsed = registrationFormSchema.safeParse(readFormValues(form));
    if (parsed.success) {
      setFieldErrors({});
      return true;
    }
    const next = issuesToFieldErrors(parsed.error.issues);
    setFieldErrors(next);
    const first = fieldOrder.find((name) => next[name]);
    if (first) {
      const el = form.elements.namedItem(first);
      if (el instanceof HTMLElement) el.focus();
    }
    return false;
  }

  function validateField(form: HTMLFormElement, name: FieldName) {
    const parsed = registrationFormSchema.safeParse(readFormValues(form));
    if (parsed.success) {
      clearFieldError(name);
      return;
    }
    const next = issuesToFieldErrors(parsed.error.issues);
    setFieldErrors((prev) => {
      const updated = { ...prev };
      if (next[name]) updated[name] = next[name];
      else delete updated[name];
      return updated;
    });
  }

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

  async function startCheckout(
    form: HTMLFormElement,
    allowCompleteRetry: boolean,
  ) {
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
    if (!result.url)
      throw new Error("Checkout could not start. Please try again.");
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
    const form = e.currentTarget;
    setFormError("");
    if (!validateAll(form)) return;
    setBusy(true);
    try {
      await startCheckout(form, true);
    } catch (cause) {
      setFormError(
        cause instanceof Error
          ? cause.message
          : "Connection interrupted. Please try again.",
      );
      setBusy(false);
    }
  }

  function onTextChange(name: FieldName) {
    return () => clearFieldError(name);
  }

  function onTextBlur(name: FieldName) {
    return (event: FocusEvent<HTMLInputElement>) => {
      const form = event.currentTarget.form;
      if (!form) return;
      // Re-check after a failed submit, or when this field still shows an error.
      if (attempted.current || fieldErrors[name]) validateField(form, name);
    };
  }

  return (
    <form
      ref={formRef}
      noValidate
      onFocus={() => {
        if (!started.current) {
          started.current = true;
          trackEvent("registration_start", { event_id: event.id });
        }
      }}
      onSubmit={submit}
      className="space-y-5"
      aria-describedby={formError ? formErrorId : undefined}
    >
      {!ready && (
        <Notice>Booking is not open yet. Please check back soon.</Notice>
      )}
      {errorCount > 0 && (
        <p
          role="alert"
          className="rounded-xl border border-red-700 bg-red-50 p-4 text-sm text-red-900"
        >
          {errorCount === 1
            ? "Fix the highlighted field below to continue."
            : `Fix the ${errorCount} highlighted fields below to continue.`}
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        {textFields.map((field) => {
          const error = fieldErrors[field.name];
          const errorId = `${field.name}-error`;
          return (
            <label key={field.name} className="text-sm font-bold">
              {field.label}
              <input
                name={field.name}
                autoComplete={field.autocomplete}
                type={field.type}
                maxLength={field.maxLength}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                onChange={onTextChange(field.name)}
                onBlur={onTextBlur(field.name)}
                className={`${inputClass} ${error ? inputErrorClass : ""}`}
              />
              <FieldError id={errorId} message={error} />
            </label>
          );
        })}
      </div>
      <label className="block text-sm font-bold">
        How did you hear about us?{" "}
        <span className="font-normal">(optional)</span>
        <input
          name="referralSource"
          maxLength={120}
          aria-invalid={fieldErrors.referralSource ? true : undefined}
          aria-describedby={
            fieldErrors.referralSource ? "referralSource-error" : undefined
          }
          onChange={onTextChange("referralSource")}
          onBlur={onTextBlur("referralSource")}
          className={`${inputClass} ${
            fieldErrors.referralSource ? inputErrorClass : ""
          }`}
        />
        <FieldError
          id="referralSource-error"
          message={fieldErrors.referralSource}
        />
      </label>
      {event.waiverText ? (
        <WaiverAcceptance
          text={event.waiverText}
          version={event.waiverVersion}
          error={fieldErrors.waiverAccepted}
          onAcceptedChange={(accepted) => {
            if (accepted) clearFieldError("waiverAccepted");
          }}
        />
      ) : (
        <div>
          <label className="flex items-start gap-3 text-sm leading-relaxed">
            <input
              name="waiverAccepted"
              type="checkbox"
              aria-invalid={fieldErrors.waiverAccepted ? true : undefined}
              aria-describedby={
                fieldErrors.waiverAccepted ? "waiverAccepted-error" : undefined
              }
              onChange={(event) => {
                if (event.target.checked) clearFieldError("waiverAccepted");
              }}
              className={`mt-1 size-5 shrink-0 accent-ink ${
                fieldErrors.waiverAccepted
                  ? "outline outline-2 outline-offset-1 outline-red-700"
                  : ""
              }`}
            />
            I have read and agree to the Participation Waiver.
          </label>
          <FieldError
            id="waiverAccepted-error"
            message={fieldErrors.waiverAccepted}
          />
        </div>
      )}
      <label className="flex min-h-12 items-start gap-3 text-sm leading-relaxed">
        <input
          name="marketingConsent"
          type="checkbox"
          className="mt-1 size-5 shrink-0 accent-ink"
        />
        Email me about future classes. (Optional — you can book without this.)
      </label>
      {formError && (
        <p
          id={formErrorId}
          role="alert"
          className="rounded-xl border border-red-700 bg-red-50 p-4 text-red-900"
        >
          {formError}
        </p>
      )}
      <button
        disabled={!ready || busy}
        aria-busy={busy || undefined}
        className={`${buttonClass} w-full`}
      >
        {busy ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            Opening secure checkout…
          </>
        ) : (
          `Continue to secure checkout - ${money(event)} ${event.currency}`
        )}
      </button>
      <p className="text-center text-xs leading-relaxed">
        Your spot is confirmed after successful payment. Your details are used
        for registration and event updates. Future-class emails are optional.
      </p>
    </form>
  );
}
