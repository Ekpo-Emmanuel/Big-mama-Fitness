"use client";
import Link from "next/link";
import {
  AdminPage,
  EmptyState,
  adminButton,
  adminSecondary,
} from "@/components/admin-ui";
export default function AdminError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <AdminPage title="Unable to load this page">
      <EmptyState title="Your event information is temporarily unavailable">
        Check your connection and try again. Your saved information is
        unchanged.
      </EmptyState>
      <div className="mt-5 flex flex-wrap gap-3">
        <button onClick={retry} className={adminButton}>
          Try again
        </button>
        <Link className={adminSecondary} href="/admin">
          All events
        </Link>
      </div>
    </AdminPage>
  );
}
