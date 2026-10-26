import { test } from "vitest";
import assert from "node:assert/strict";
import { initialEvent } from "../lib/event";
import {
  eventPurchaseFingerprint,
  purchaseMaterial,
  purchaseMismatchMessage,
  registrationAvailabilityMessage,
} from "../lib/event-purchase";

test("purchase fingerprint ignores non-material fields", () => {
  const base = purchaseMaterial(initialEvent);
  const a = eventPurchaseFingerprint(initialEvent);
  const b = eventPurchaseFingerprint({
    ...initialEvent,
    headline: "changed",
    description: "changed",
    heroImageUrl: "/media/new.jpg",
    instructorBio: "changed",
    subheadline: "changed",
  });
  assert.equal(a, b);
  const priced = eventPurchaseFingerprint({
    ...initialEvent,
    priceCents: 1200,
  });
  assert.notEqual(a, priced);
  assert.match(
    purchaseMismatchMessage(base, { ...base, priceCents: 1200 }),
    /ticket price changed/,
  );
  assert.match(
    purchaseMismatchMessage(base, {
      ...base,
      startsAt: "2099-01-01T17:00:00-08:00",
    }),
    /event time was updated/,
  );
  assert.match(
    purchaseMismatchMessage(base, { ...base, waiverVersion: "v2" }),
    /waiver was updated/,
  );
});

test("availability messages are specific", () => {
  const now = Date.parse("2026-10-01");
  assert.equal(
    registrationAvailabilityMessage(
      { ...initialEvent, status: "sold_out" },
      20,
      0,
      now,
    ),
    "This class just sold out.",
  );
  assert.equal(
    registrationAvailabilityMessage(
      { ...initialEvent, status: "cancelled" },
      0,
      0,
      now,
    ),
    "This event has been cancelled. Registration is closed.",
  );
  assert.equal(
    registrationAvailabilityMessage(initialEvent, 19, 1, now),
    "The remaining spots are being checked out. Please try again shortly.",
  );
  assert.equal(
    registrationAvailabilityMessage(
      { ...initialEvent, capacity: 15 },
      15,
      0,
      now,
    ),
    "This class just sold out.",
  );
  assert.equal(
    registrationAvailabilityMessage(
      { ...initialEvent, capacity: 15 },
      14,
      1,
      now,
    ),
    "The remaining spots are being checked out. Please try again shortly.",
  );
});
