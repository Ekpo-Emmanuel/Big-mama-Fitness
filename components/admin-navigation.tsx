"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ScanLine,
  MessageSquare,
  Heart,
  SlidersHorizontal,
} from "lucide-react";

export function AdminNavigation({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  const root = `/admin/events/${eventId}`;
  const items = [
    { path: "", label: "Overview", icon: LayoutDashboard },
    { path: "/guests", label: "Guests", icon: Users },
    { path: "/check-in", label: "Check-in", icon: ScanLine },
    { path: "/feedback", label: "Feedback", icon: MessageSquare },
    { path: "/leads", label: "Future-event leads", icon: Heart },
    { path: "/details", label: "Event details", icon: SlidersHorizontal },
  ];
  const link = (item: (typeof items)[number], mobile = false) => {
    const active = pathname === root + item.path;
    const Icon = item.icon;
    return (
      <Link
        key={item.path}
        href={root + item.path}
        aria-current={active ? "page" : undefined}
        className={`${mobile ? "flex-col gap-1 px-1 py-2 text-[11px]" : "gap-2 px-4 py-3 text-sm"} motion-press flex min-h-12 min-w-0 items-center justify-center rounded-xl font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 ${active ? "bg-ink text-white" : "text-ink/70 hover:bg-lilac/40"}`}
      >
        <Icon size={18} aria-hidden="true" />
        <span>{item.label}</span>
      </Link>
    );
  };
  return (
    <>
      <nav
        aria-label="Event navigation"
        className="hidden border-b border-ink/10 bg-white/70 md:block"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap gap-1 px-6 py-2">
          {items.map((item) => link(item))}
        </div>
      </nav>
      <nav
        aria-label="Mobile event navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/15 bg-cream p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
          {items.slice(0, 3).map((item) => link(item, true))}
          <details
            key={pathname}
            className="motion-disclosure motion-menu group"
          >
            <summary
              className={`flex min-h-14 cursor-pointer list-none flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold focus-visible:outline-2 ${items.slice(3).some((item) => pathname === root + item.path) ? "bg-ink text-white" : "text-ink/70"}`}
            >
              <SlidersHorizontal size={18} aria-hidden="true" />
              More
            </summary>
            <div className="absolute inset-x-3 bottom-full mb-2 rounded-2xl border border-ink/15 bg-cream p-2 shadow-lg">
              {items.slice(3).map((item) => link(item))}
            </div>
          </details>
        </div>
      </nav>
    </>
  );
}
