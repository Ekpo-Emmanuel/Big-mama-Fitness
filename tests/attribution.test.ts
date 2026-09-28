import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanAttribution,
  analyticsAttribution,
  sessionFor,
} from "../lib/attribution";
test("attribution rejects contact-like values and analytics only forwards known campaign values", () => {
  const result = cleanAttribution({
    utm_source: "poster",
    utm_medium: "qr",
    utm_campaign: "october17",
    utm_content: "gym_lobby",
    email: "private@example.com",
    utm_term: "private",
    client_id: "123.456",
    session_id: 123,
  });
  assert.equal("email" in result, false);
  assert.equal("utm_term" in result, false);
  assert.equal(
    cleanAttribution({ utm_source: "person@example.com" }).utm_source,
    undefined,
  );
  assert.deepEqual(
    analyticsAttribution({ utm_source: "private_name", utm_medium: "qr" }),
    { utm_medium: "qr" },
  );
  assert.equal(result.client_id, "123.456");
  assert.deepEqual(
    analyticsAttribution({
      utm_source: "instagram",
      utm_medium: "social",
      utm_campaign: "october17",
      utm_content: "reel1",
    }),
    {
      utm_source: "instagram",
      utm_medium: "social",
      utm_campaign: "october17",
      utm_content: "reel1",
    },
  );
  assert.deepEqual(
    analyticsAttribution({
      utm_source: "poster",
      utm_medium: "qr",
      utm_campaign: "october17",
      utm_content: "gym",
    }),
    {
      utm_source: "poster",
      utm_medium: "qr",
      utm_campaign: "october17",
      utm_content: "gym",
    },
  );
});
test("analytics session expires separately from first-touch campaign attribution", () => {
  const now = 2000000000000;
  const first = sessionFor(undefined, now);
  assert.equal(sessionFor(first, now + 10 * 60000).id, first.id);
  assert.notEqual(sessionFor(first, now + 31 * 60000).id, first.id);
});
