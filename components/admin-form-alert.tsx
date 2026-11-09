"use client";

import { useEffect, useRef } from "react";

export function AdminFormAlert({ message }: { message: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [message]);
  if (!message) return null;
  return (
    <p
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-live="assertive"
      className="rounded-xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950 ring-1 ring-amber-800/15"
    >
      {message}
    </p>
  );
}
