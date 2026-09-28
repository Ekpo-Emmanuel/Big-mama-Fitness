"use client";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";
import { getAttribution } from "@/lib/attribution";
export function AnalyticsProvider() {
  const pathname = usePathname();
  const last = useRef("");
  const configured = useRef(false);
  const gtm = process.env.NEXT_PUBLIC_GTM_ID;
  const ga = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  useEffect(() => {
    if (!gtm && ga && !configured.current) {
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
    if (last.current !== pathname) {
      last.current = pathname;
      trackEvent("page_view");
    }
  }, [pathname, gtm, ga]);
  if (gtm && /^GTM-[A-Z0-9]+$/.test(gtm))
    return (
      <Script
        id="gtm"
        strategy="afterInteractive"
      >{`window.dataLayer=window.dataLayer||[];window.dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtm.js?id=${gtm}';document.head.appendChild(s);`}</Script>
    );
  if (ga && /^G-[A-Z0-9]+$/.test(ga))
    return (
      <Script
        src={"https://www.googletagmanager.com/gtag/js?id=" + ga}
        strategy="afterInteractive"
      />
    );
  return null;
}
