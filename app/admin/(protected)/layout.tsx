import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { fetchAuthMutation } from "@/lib/auth-server";
import { api } from "@/lib/convex";
import { SignOutButton } from "@/components/sign-out-button";
export const metadata = {
  title: "Organizer dashboard",
  robots: { index: false, follow: false },
};
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  await fetchAuthMutation(api.events.ensureSeeded, {});
  return (
    <>
      <header className="border-b border-ink/10 bg-cream">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/admin" className="min-w-0">
            <span className="block font-display text-xl uppercase tracking-wide">
              Big Mama Fitness
            </span>
            <span className="block text-xs text-ink/65">
              Organizer workspace
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/new"
              className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-ink px-3 text-sm font-semibold text-white"
            >
              <span className="sm:hidden">New</span>
              <span className="hidden sm:inline">Create event</span>
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main id="main">{children}</main>
    </>
  );
}
