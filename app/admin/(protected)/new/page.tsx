import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/lib/convex";
import { initialEvent, type DanceEvent } from "@/lib/event";
import { AdminPage } from "@/components/admin-ui";
import { AdminNewEventForm } from "@/components/admin-new-event-form";

export default async function NewEventPage() {
  await requireAdmin();
  let listed: DanceEvent[] = [];
  try {
    const result = await fetchAuthQuery(api.events.listAll, {});
    listed = Array.isArray(result) ? result : [];
  } catch {
    listed = [];
  }
  const template =
    listed.find((event) => event.status === "published" && event.startsAt) ??
    listed.find((event) => event.startsAt) ??
    initialEvent;
  if (!template?.id) redirect("/admin");
  return (
    <AdminPage
      title="Create event"
      description="Set the class, ticket, instructor, and waiver. Save as draft to keep it private, or open registration when guests can buy."
      actions={
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
        >
          Back to events
        </Link>
      }
    >
      <div className="max-w-4xl">
        <AdminNewEventForm template={template} />
      </div>
    </AdminPage>
  );
}
