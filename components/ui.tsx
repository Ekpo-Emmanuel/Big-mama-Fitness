import type { ReactNode } from "react";
export const buttonClass =
  "inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-ink px-6 py-3 text-center text-sm font-bold text-white transition hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50";
export const inputClass =
  "mt-2 min-h-12 w-full rounded-xl border border-ink/25 bg-white px-4 py-3 text-base outline-none focus:border-ink focus:ring-2 focus:ring-lilac";
export const headingClass =
  "font-display text-4xl leading-[1.05] tracking-tight uppercase sm:text-5xl lg:text-6xl";
export function Section({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20 lg:px-12 ${className}`}
    >
      {children}
    </section>
  );
}
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 text-xs font-bold tracking-[0.18em] uppercase">
      {children}
    </p>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="rounded-xl border border-ink/20 bg-sun/30 p-4 text-sm leading-relaxed"
    >
      {children}
    </p>
  );
}
