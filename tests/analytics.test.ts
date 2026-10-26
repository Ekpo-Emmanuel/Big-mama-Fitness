import { test } from "vitest";
import assert from "node:assert/strict";
import { trackEvent } from "../lib/analytics";
import { eventCalendarDate, initialEvent } from "../lib/event";
import { findKnownEvent, trackingEventForPath } from "../lib/known-events";

test("known events resolve October and November tracking dates", () => {
  assert.equal(trackingEventForPath("/")?.id, initialEvent.id);
  assert.equal(
    trackingEventForPath("/event/afro-dance-fitness/register")?.id,
    "afro-oct-2026",
  );
  assert.equal(
    trackingEventForPath("/event/afro-dance-fitness-nov-21")?.id,
    "afro-nov-2026",
  );
  assert.equal(findKnownEvent("afro-nov-2026")?.capacity, 15);
  assert.equal(eventCalendarDate(initialEvent), "2026-10-17");
  assert.equal(
    eventCalendarDate(findKnownEvent("afro-nov-2026")!),
    "2026-11-21",
  );
});

test("browser events include event_id and event_date", () => {
  const pushed: unknown[] = [];
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
  Object.defineProperty(globalThis, "window", {
    value: {
      location: {
        origin: "https://example.test",
        pathname: "/event/afro-dance-fitness-nov-21",
        search: "",
      },
      dataLayer: pushed,
    },
    configurable: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    value: storage,
    configurable: true,
  });
  Object.defineProperty(globalThis, "document", {
    value: { cookie: "" },
    configurable: true,
  });
  trackEvent("page_view");
  trackEvent("reserve_spot_click", { event_id: "afro-oct-2026" });
  const pageView = pushed[0] as {
    event: string;
    event_id: string;
    event_date: string;
  };
  const click = pushed[1] as { event_id: string; event_date: string };
  assert.equal(pageView.event, "page_view");
  assert.equal(pageView.event_id, "afro-nov-2026");
  assert.equal(pageView.event_date, "2026-11-21");
  assert.equal(click.event_id, "afro-oct-2026");
  assert.equal(click.event_date, "2026-10-17");
});
