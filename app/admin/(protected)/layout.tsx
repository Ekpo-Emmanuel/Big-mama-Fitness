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
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-6">
        <Link href="/admin" className="font-bold">
          Organizer dashboard
        </Link>
        <SignOutButton />
      </header>
      <main id="main">{children}</main>
    </>
  );
}
