"use client";
import { useState } from "react";
import {
  Detail,
  EmptyState,
  StatusBadge,
  adminPanel,
  formatDate,
  formatAttribution,
} from "./admin-ui";
export type AdminLead = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  marketing_consent: number;
  marketing_consent_at: string | null;
  attribution: string;
  created_at: string;
};
export function AdminLeads({
  rows,
  timezone,
}: {
  rows: AdminLead[];
  timezone: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = rows.filter((row) =>
    `${row.first_name} ${row.last_name} ${row.email} ${row.phone}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  return (
    <div className="space-y-4">
      <label className="block text-sm font-semibold">
        Search future-event leads
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, email or phone"
          className="mt-2 min-h-12 w-full rounded-xl border border-ink/25 bg-white px-4 text-base focus:outline-2 focus:outline-ink"
        />
      </label>
      <p className="text-xs text-ink/65">
        {filtered.length} {filtered.length === 1 ? "lead" : "leads"}
      </p>
      {!filtered.length && (
        <EmptyState
          title={query ? "No matching leads" : "No future-event leads yet"}
        >
          {query
            ? "Try another name or contact detail."
            : "People who ask about future classes will appear here."}
        </EmptyState>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {filtered.map((row) => (
          <article key={row.id} className={adminPanel}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="min-w-0 font-semibold [overflow-wrap:anywhere]">
                {row.first_name} {row.last_name}
              </h2>
              <StatusBadge
                status={row.marketing_consent ? "accepted" : "closed"}
              >
                {row.marketing_consent
                  ? "Marketing opted in"
                  : "No marketing consent"}
              </StatusBadge>
            </div>
            <a
              className="mt-3 block min-h-11 py-2 text-sm underline [overflow-wrap:anywhere]"
              href={`mailto:${row.email}`}
            >
              {row.email}
            </a>
            <a
              className="inline-flex min-h-11 items-center text-sm underline"
              href={`tel:${row.phone}`}
            >
              {row.phone}
            </a>
            <details className="mt-3 border-t border-ink/10">
              <summary className="cursor-pointer py-3 text-xs font-semibold">
                Interest & consent details
              </summary>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Detail label="Interest registered">
                  {formatDate(row.created_at, timezone)}
                </Detail>
                <Detail label="Consent recorded">
                  {formatDate(row.marketing_consent_at, timezone)}
                </Detail>
                <Detail label="Source">
                  {formatAttribution(row.attribution)}
                </Detail>
              </dl>
            </details>
          </article>
        ))}
      </div>
    </div>
  );
}
