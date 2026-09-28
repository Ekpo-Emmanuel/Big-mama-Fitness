import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvent } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { AdminNavigation } from "@/components/admin-navigation";

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();
  return (
    <div className="pb-24 md:pb-4">
      <AdminNavigation eventId={id} />
      {children}
    </div>
  );
}
