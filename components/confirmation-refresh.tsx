"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function ConfirmationRefresh({ pending }: { pending: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!pending) return;
    let attempts = 0;
    const timer = setInterval(() => {
      router.refresh();
      if (++attempts >= 20) clearInterval(timer);
    }, 3000);
    return () => clearInterval(timer);
  }, [pending, router]);
  return null;
}
