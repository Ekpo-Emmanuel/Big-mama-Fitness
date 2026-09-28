import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/lib/convex";
import type { DanceEvent } from "@/lib/event";
import { Section } from "@/components/ui";
export default async function Admin() {
  await requireAdmin();
  const events: DanceEvent[] = await fetchAuthQuery(api.events.listAll, {});
  return (
    <Section>
      <h1 className="text-3xl font-bold">Your events</h1>
      <div className="mt-8 grid gap-5">
        {events.length === 0 ? (
          <p>No events in the database yet.</p>
        ) : (
          events.map((e) => (
            <Link
              key={e.id}
              href={`/admin/events/${e.id}`}
              className="rounded-2xl border border-ink/20 bg-white p-6 underline"
            >
              {e.name}
            </Link>
          ))
        )}
      </div>
    </Section>
  );
}
