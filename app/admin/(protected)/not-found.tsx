import Link from "next/link";
import { AdminPage, EmptyState, adminButton } from "@/components/admin-ui";
export default function NotFound() {
  return (
    <AdminPage title="Event not found">
      <EmptyState title="This page is unavailable">
        Choose an event from your event list to continue.
      </EmptyState>
      <Link href="/admin" className={`${adminButton} mt-5`}>
        All events
      </Link>
    </AdminPage>
  );
}
