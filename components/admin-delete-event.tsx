"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex";
import { initialEvent, octoberEvent, type DanceEvent } from "@/lib/event";
import { adminSecondary } from "@/components/admin-ui";
import { adminErrorMessage } from "@/lib/admin-error";

export function canDeleteUpcomingEvent(event: DanceEvent, now = Date.now()) {
  return (
    Date.parse(event.startsAt) > now &&
    event.status !== "completed" &&
    event.id !== initialEvent.id &&
    event.id !== octoberEvent.id
  );
}

export function AdminDeleteEventButton({ event }: { event: DanceEvent }) {
  const router = useRouter();
  const remove = useMutation(api.events.deleteEvent);
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  if (!canDeleteUpcomingEvent(event)) return null;

  return (
    <>
      <button
        type="button"
        className={`${adminSecondary} border-amber-800/30 text-amber-950`}
        onClick={() => {
          setError("");
          dialog.current?.showModal();
        }}
      >
        Delete event
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="delete-event-title"
        className="motion-dialog fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl bg-cream p-5 text-ink shadow-xl backdrop:bg-ink/40"
      >
        <h2 id="delete-event-title" className="text-xl font-bold">
          Delete this event?
        </h2>
        <p className="mt-3 text-sm leading-relaxed">
          {event.name} will be removed from admin and the public site. Incomplete
          checkouts and next-class leads for this date are removed too.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink/70">
          Paid guests must be refunded in Stripe and cancelled here first. Past
          classes stay in history.
        </p>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-amber-950">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            className={adminSecondary}
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            Keep event
          </button>
          <button
            type="button"
            className="motion-press inline-flex min-h-11 items-center justify-center rounded-xl bg-amber-950 px-4 py-2.5 text-sm font-semibold text-cream hover:bg-amber-950/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:opacity-50"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                await remove({ eventId: event.id });
                dialog.current?.close();
                router.push("/admin");
                router.refresh();
              } catch (caught) {
                setError(adminErrorMessage(caught, "Could not delete event."));
                setPending(false);
              }
            }}
          >
            {pending ? "Deleting…" : "Delete event"}
          </button>
        </div>
      </dialog>
    </>
  );
}
