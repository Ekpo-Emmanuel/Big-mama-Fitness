"use client";
import Link from "next/link";
import {
  AdminPage,
  EmptyState,
  adminButton,
  adminSecondary,
} from "@/components/admin-ui";
import { publicPageError } from "@/lib/admin-error";
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AdminPage title="Unable to load this page">
      <EmptyState title="Your event information is temporarily unavailable">
        {publicPageError(error)}
      </EmptyState>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={() => reset()} className={adminButton}>
          Try again
        </button>
        <Link className={adminSecondary} href="/admin">
          All events
        </Link>
      </div>
    </AdminPage>
  );
}
