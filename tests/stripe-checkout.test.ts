import { test } from "vitest";
import assert from "node:assert/strict";
import { initialEvent } from "../lib/event";
import type { Attendee } from "../lib/booking";
import {
  checkoutIdempotencyKey,
  checkoutProductDescription,
  checkoutProductImage,
  checkoutSessionParams,
} from "../lib/stripe";

const row = {
  id: "attendee_test",
  email: "private@example.com",
  currency: "CAD",
  expires_at: 1_800_000_000,
  confirmation_token: "secret-token",
} as Attendee;

test("checkout product copy uses event schedule and city, not attendee data", () => {
  const description = checkoutProductDescription(initialEvent);
  assert.match(description, /Saturday, October 17, 2026/);
  assert.match(description, /5:00/);
  assert.match(description, /6:30/);
  assert.match(description, /Nanaimo, BC/);
  assert.equal(description.includes("private@example.com"), false);
  assert.equal(description.includes("secret-token"), false);
});

test("checkout omits localhost and empty hero images", () => {
  assert.equal(checkoutProductImage(initialEvent), undefined);
  assert.equal(
    checkoutProductImage(
      { ...initialEvent, heroImageUrl: "/media/hero.jpg" },
      "http://localhost:3000",
    ),
    undefined,
  );
  assert.equal(
    checkoutProductImage(
      { ...initialEvent, heroImageUrl: "/media/hero.jpg" },
      "https://www.bigmamafit.ca",
    ),
    "https://www.bigmamafit.ca/media/hero.jpg",
  );
});

test("checkout idempotency key changes after hold refresh or prior session", () => {
  const base = {
    request_key: "11111111-1111-1111-1111-111111111111",
    expires_at: 1_800_000_000,
    stripe_session_id: null as string | null,
  };
  const first = checkoutIdempotencyKey(base);
  const afterRefresh = checkoutIdempotencyKey({
    ...base,
    expires_at: 1_800_001_860,
  });
  const afterPrior = checkoutIdempotencyKey({
    ...base,
    stripe_session_id: "cs_test_prior",
  });
  assert.notEqual(first, afterRefresh);
  assert.notEqual(first, afterPrior);
  assert.equal(checkoutIdempotencyKey(base), first);
});

test("checkout session params brand hosted Checkout without changing payment mode", () => {
  const params = checkoutSessionParams(initialEvent, row);
  assert.equal(params.mode, "payment");
  assert.equal(params.submit_type, "book");
  assert.equal(params.branding_settings?.display_name, "Big Mama Fitness");
  assert.equal(params.branding_settings?.background_color, "#fff9ef");
  assert.equal(params.branding_settings?.button_color, "#321b39");
  assert.equal(params.branding_settings?.border_style, "pill");
  assert.equal(params.branding_settings?.font_family, "inter");
  assert.equal(params.line_items?.[0]?.price_data?.product_data?.name, initialEvent.name);
  assert.match(
    params.line_items?.[0]?.price_data?.product_data?.description || "",
    /Nanaimo, BC/,
  );
  assert.equal(params.line_items?.[0]?.price_data?.product_data?.images, undefined);
  assert.equal(params.payment_method_types, undefined);
  const submit = params.custom_text?.submit;
  const message = submit && typeof submit === "object" ? submit.message : "";
  assert.equal(message?.includes("confirmed"), true);
});
