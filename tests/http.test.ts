import { test } from "node:test";
import assert from "node:assert/strict";
import { readJson, sameOrigin } from "../lib/http";
import { registrationSchema } from "../lib/validation";
test("cross-origin writes, oversized JSON, malformed JSON, and invalid contacts are rejected", async () => {
  assert.throws(() =>
    sameOrigin(
      new Request("http://localhost:3000/api/events/test/checkout", {
        headers: { origin: "https://wrong.example" },
      }),
    ),
  );
  await assert.rejects(() =>
    readJson(
      new Request("http://localhost/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "x".repeat(13000),
      }),
    ),
  );
  await assert.rejects(() =>
    readJson(
      new Request("http://localhost/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    ),
  );
  assert.equal(
    registrationSchema.safeParse({ email: "invalid", waiverAccepted: false })
      .success,
    false,
  );
});
