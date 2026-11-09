"use client";

import { useId, useState, type ReactNode } from "react";
import { CircleHelp } from "lucide-react";

export function AdminHintedField({
  id,
  label,
  term,
  hint,
  children,
}: {
  id: string;
  label: string;
  term: string;
  hint: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hintId = useId();
  return (
    <div className="grid gap-2">
      <div className="flex items-center">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        <button
          type="button"
          className="motion-press inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink/55 hover:bg-lilac/50 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          aria-expanded={open}
          aria-controls={hintId}
          aria-label={`What ${term} means`}
          onClick={() => setOpen((value) => !value)}
        >
          <CircleHelp size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      {open ? (
        <p
          id={hintId}
          role="note"
          className="rounded-xl bg-ink px-3 py-2 text-sm font-normal leading-relaxed text-cream"
        >
          {hint}
        </p>
      ) : null}
      {children}
    </div>
  );
}
