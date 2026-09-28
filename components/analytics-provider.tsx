"use client";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  isValidGaMeasurementId,
  isValidGtmId,
  trackEvent,
} from "@/lib/analytics";
import { getAttribution } from "@/lib/attribution";

function shouldTrackPath(pathname: string) {
  return !(
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  );
}

export function AnalyticsProvider() {
  const pathname = usePathname();
  const last = useRef("");
  const configured = useRef(false);
  const gtm = process.env.NEXT_PUBLIC_GTM_ID;
  const ga = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  useEffect(() => {
    // GTM script lives in root layout. Direct GA config only when GTM absent.
    if (!isValidGtmId(gtm) && isValidGaMeasurementId(ga) && !configured.current) {
      configured.current = true;
      window.dataLayer = window.dataLayer || [];
      window.gtag =
        window.gtag ||
        function (...args: unknown[]) {
          window.dataLayer.push(args);
        };
      window.gtag("js", new Date());
      window.gtag("config", ga, {
        send_page_view: false,
        page_location: location.origin + location.pathname,
        page_referrer: "",
        client_id: getAttribution().client_id,
      });
    }
    if (!shouldTrackPath(pathname)) return;
    if (last.current !== pathname) {
      last.current = pathname;
      trackEvent("page_view");
    }
  }, [pathname, gtm, ga]);
  // Direct GA script fallback when GTM is not configured.
  if (!isValidGtmId(gtm) && isValidGaMeasurementId(ga))
    return (
      <Script
        src={"https://www.googletagmanager.com/gtag/js?id=" + ga}
        strategy="afterInteractive"
      />
    );
  return null;
}
