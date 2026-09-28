"use client";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { buttonClass } from "./ui";

const WAIVER_TITLE = "Participation Waiver and Assumption of Risk";

export function WaiverAcceptance({
  text,
  version,
  error,
  onAcceptedChange,
}: {
  text: string;
  version: string;
  error?: string;
  onAcceptedChange?: (accepted: boolean) => void;
}) {
  const formId = useId();
  const titleId = useId();
  const labelId = useId();
  const errorId = useId();
  const [accepted, setAccepted] = useState(false);
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function updateAccepted(next: boolean) {
    setAccepted(next);
    onAcceptedChange?.(next);
  }

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog || dialog.open) return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function handleNativeClose() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function requestClose() {
    dialogRef.current?.close();
  }

  function acceptAndContinue() {
    updateAccepted(true);
    requestClose();
  }

  return (
    <>
      <div data-waiver-version={version}>
        <div className="flex min-h-12 items-start gap-3 text-sm leading-relaxed">
          <input
            id={formId}
            name="waiverAccepted"
            type="checkbox"
            checked={accepted}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            aria-labelledby={labelId}
            onChange={(event) => updateAccepted(event.target.checked)}
            className={`mt-1 size-5 shrink-0 accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
              error ? "outline outline-2 outline-offset-1 outline-red-700" : ""
            }`}
          />
          <p id={labelId}>
            I have read and agree to the{" "}
            <button
              ref={triggerRef}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={open}
              className="font-bold text-ink underline decoration-orange decoration-2 underline-offset-2 hover:text-orange focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              onClick={() => setOpen(true)}
            >
              {WAIVER_TITLE}
            </button>
            .
          </p>
        </div>
        {error ? (
          <p
            id={errorId}
            role="alert"
            className="mt-2 text-sm font-normal text-red-800"
          >
            {error}
          </p>
        ) : null}
      </div>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="motion-dialog motion-sheet fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-end justify-center border-0 bg-transparent p-0 backdrop:bg-ink/50 not-open:hidden sm:items-center"
        onClose={handleNativeClose}
        onClick={(event) => {
          if (event.target === event.currentTarget) requestClose();
        }}
      >
        <div
          className="motion-sheet-panel flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-cream text-ink shadow-xl sm:mx-4 sm:max-w-lg sm:rounded-3xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 border-b border-ink/15 px-5 py-4 sm:px-6">
            <div>
              <p className="mb-2 text-[10px] font-bold tracking-[0.18em] uppercase">
                Required
              </p>
              <h2
                id={titleId}
                className="font-display text-3xl leading-[1.05] uppercase"
              >
                {WAIVER_TITLE}
              </h2>
            </div>
            <button
              type="button"
              aria-label="Close"
              className="motion-press inline-flex size-11 shrink-0 items-center justify-center rounded-full text-2xl leading-none hover:bg-ink/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              onClick={requestClose}
            >
              ×
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
            <p className="whitespace-pre-wrap text-base leading-relaxed">
              {text}
            </p>
          </div>
          <div className="border-t border-ink/15 bg-cream px-5 py-4 sm:px-6">
            <button
              type="button"
              className={`${buttonClass} w-full`}
              onClick={acceptAndContinue}
            >
              Accept & Continue
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
