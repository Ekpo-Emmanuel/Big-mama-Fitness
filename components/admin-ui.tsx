import type { ReactNode } from "react";

export const adminButton =
  "motion-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:cursor-wait disabled:opacity-50";
export const adminSecondary =
  "motion-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-ink/20 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-lilac/30 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:opacity-50";
export const adminPanel =
  "rounded-2xl border border-ink/10 bg-white p-5 sm:p-6";

const labels: Record<string, string> = {
  paid: "Paid",
  pending: "Payment incomplete",
  refunded: "Refunded",
  confirmed: "Not checked in",
  checked_in: "Checked in",
  no_show: "No-show",
  cancelled: "Cancelled",
  open: "Sales open",
  closed: "Sales closed",
  published: "Published",
  sold_out: "Sold out",
  completed: "Completed",
  draft: "Draft",
  held: "Hold active",
  released: "Hold expired",
  accepted: "Waiver accepted",
  missing: "Waiver missing",
};
export function StatusBadge({
  status,
  children,
}: {
  status: string;
  children?: ReactNode;
}) {
  const tone = ["paid", "checked_in", "open", "accepted"].includes(status)
    ? "bg-emerald-50 text-emerald-900 ring-emerald-700/15"
    : ["pending", "held", "missing"].includes(status)
      ? "bg-amber-50 text-amber-900 ring-amber-700/15"
      : "bg-ink/5 text-ink/80 ring-ink/10";
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ${tone}`}
    >
      {children || labels[status] || status.replaceAll("_", " ")}
    </span>
  );
}
export function AdminPage({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-6xl min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/70">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-ink/20 bg-white/60 px-5 py-10 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink/70">
        {children}
      </p>
    </div>
  );
}
export function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-white p-4 sm:p-5">
      <p className="text-sm text-ink/70">{label}</p>
      <p className="mt-2 break-words text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">
        {value}
      </p>
      {detail && (
        <p className="mt-2 text-xs leading-relaxed text-ink/65">{detail}</p>
      )}
    </div>
  );
}
export function Detail({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-ink/65">{label}</dt>
      <dd className="mt-1 text-sm leading-relaxed [overflow-wrap:anywhere]">
        {children || "Not provided"}
      </dd>
    </div>
  );
}
export function formatAmount(cents: number, currency: string) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(
    cents / 100,
  );
}
export function formatDate(value: string | null, timezone: string) {
  return value
    ? new Date(value).toLocaleString("en-CA", {
        timeZone: timezone,
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not recorded";
}

export function formatAttribution(value: string) {
  try {
    const fields: unknown = JSON.parse(value);
    if (!fields || typeof fields !== "object") return "Not recorded";
    return (
      [
        ["utm_source", "Source"],
        ["utm_medium", "Channel"],
        ["utm_campaign", "Campaign"],
        ["utm_content", "Placement"],
      ]
        .flatMap(([key, label]) => {
          const entry = (fields as Record<string, unknown>)[key];
          return typeof entry === "string" && entry
            ? [`${label}: ${entry.replaceAll("_", " ")}`]
            : [];
        })
        .join(" · ") || "Not recorded"
    );
  } catch {
    return value && !value.trim().startsWith("{")
      ? value.replaceAll("_", " ")
      : "Not recorded";
  }
}
