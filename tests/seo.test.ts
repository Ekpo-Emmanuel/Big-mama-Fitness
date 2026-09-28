import { test } from "node:test";
import assert from "node:assert/strict";
import { initialEvent } from "../lib/event";
import { eventSchema, safeJson, eventMetadata } from "../lib/seo";
test("schema includes configured price, timezone, address, and actual availability", () => {
  const e = {
    ...initialEvent,
    startsAt: "2099-10-17T17:00:00-07:00",
    endsAt: "2099-10-17T18:30:00-07:00",
  };
  assert.equal(
    eventSchema(e, 0).offers.availability,
    "https://schema.org/InStock",
  );
  assert.equal(
    eventSchema(e, 20).offers.availability,
    "https://schema.org/SoldOut",
  );
  assert.equal(eventSchema(e, 20).offers.price, 10);
  assert.equal(
    eventSchema({ ...e, status: "cancelled" }, 0).eventStatus,
    "https://schema.org/EventCancelled",
  );
  assert.equal(
    eventSchema(e, 0).location.address.streetAddress,
    "1969 Boxwood Rd",
  );
  assert.ok(eventMetadata(e).alternates?.canonical);
});
test("structured data cannot terminate its script element", () => {
  assert.equal(
    safeJson({ name: "</script><script>alert(1)</script>" }).includes("<"),
    false,
  );
});
