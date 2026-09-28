"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { buttonClass, inputClass, Notice } from "./ui";
import { trackEvent } from "@/lib/analytics";
import {
  FEEDBACK_SENTIMENT_LABELS,
  FEEDBACK_SENTIMENTS,
  type FeedbackSentiment,
} from "@/lib/feedback";

type Existing = {
  rating: number;
  sentiment: FeedbackSentiment | null;
  enjoyedMost: string;
  improvement: string;
};

export function FeedbackForm({
  eventId,
  token,
  alreadySubmitted,
  existing,
}: {
  eventId: string;
  eventName?: string;
  firstName?: string;
  token: string;
  alreadySubmitted: boolean;
  existing: Existing | null;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [sentiment, setSentiment] = useState<FeedbackSentiment | "">(
    existing?.sentiment ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (rating < 1 || rating > 5) {
      setError("Pick a star rating.");
      return;
    }
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      const response = await fetch(`/api/events/${eventId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          rating,
          sentiment: sentiment || null,
          enjoyedMost: String(data.get("enjoyedMost") || ""),
          improvement: String(data.get("improvement") || ""),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      trackEvent("feedback_submitted", { event_id: eventId });
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="motion-enter space-y-6 text-center">
        <h1 className="font-display text-4xl uppercase leading-[1.05] tracking-tight sm:text-5xl">
          Thanks for the feedback 💛
        </h1>
        <p className="text-lg leading-relaxed">
          We really appreciate you joining us.
        </p>
        <Link href="/" className={buttonClass}>
          Back to Big Mama Fitness
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg space-y-8">
      <div className="space-y-3 text-center sm:text-left">
        <p className="text-xs font-bold tracking-[0.18em] uppercase">
          Big Mama Fitness
        </p>
        <h1 className="font-display text-4xl uppercase leading-[1.05] tracking-tight sm:text-5xl">
          How was class?
        </h1>
        <p className="text-base leading-relaxed text-ink/85">
          Thanks for coming! How was the class?
        </p>
      </div>

      <fieldset className="min-w-0">
        <legend className="text-sm font-bold">
          How would you rate the class?
        </legend>
        <div
          className="mt-3 flex gap-2 justify-start"
          role="radiogroup"
          aria-label="How would you rate the class?"
        >
          {[1, 2, 3, 4, 5].map((value) => {
            const filled = rating >= value;
            const exact = rating === value;
            const label = value === 1 ? "1 star" : `${value} stars`;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={exact}
                aria-label={label}
                title={label}
                onClick={() => setRating(value)}
                className={`motion-press flex h-14 w-14 items-center justify-center rounded-2xl text-3xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                  filled
                    ? "scale-105 bg-orange text-cream"
                    : "bg-white text-ink/30 hover:bg-lilac/60 hover:text-ink/70"
                }`}
              >
                ★
              </button>
            );
          })}
        </div>
        {rating > 0 && (
          <p
            className="mt-2 text-left text-sm font-bold text-ink/75"
            aria-live="polite"
          >
            {rating === 1 ? "1 star" : `${rating} stars`} selected
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend className="text-sm font-bold">How was your experience?</legend>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {FEEDBACK_SENTIMENTS.map((value) => {
            const active = sentiment === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setSentiment((current) => (current === value ? "" : value))
                }
                className={`motion-press min-h-12 rounded-2xl px-3 py-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                  active
                    ? "bg-ink text-cream"
                    : "bg-white text-ink hover:bg-lilac/50"
                }`}
              >
                {FEEDBACK_SENTIMENT_LABELS[value]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-sm font-bold">
          What did you enjoy most?{" "}
          <span className="font-normal text-ink/60">(optional)</span>
        </span>
        <textarea
          name="enjoyedMost"
          rows={3}
          maxLength={500}
          defaultValue={existing?.enjoyedMost ?? ""}
          className={inputClass}
          placeholder="The music, the vibe, the workout…"
        />
      </label>

      <label className="block">
        <span className="text-sm font-bold">
          Anything we could improve?{" "}
          <span className="font-normal text-ink/60">(optional)</span>
        </span>
        <textarea
          name="improvement"
          rows={3}
          maxLength={500}
          defaultValue={existing?.improvement ?? ""}
          className={inputClass}
          placeholder="Optional notes for Brenda"
        />
      </label>

      {error && <Notice>{error}</Notice>}

      <button
        type="submit"
        disabled={busy}
        aria-busy={busy}
        className={`${buttonClass} w-full`}
      >
        {busy
          ? "Sending…"
          : alreadySubmitted
            ? "Update feedback"
            : "Submit feedback"}
      </button>
    </form>
  );
}
