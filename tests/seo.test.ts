import { test } from "node:test";
import assert from "node:assert/strict";
import { initialEvent } from "../lib/event";
import {
  eventSchema,
  safeJson,
  eventMetadata,
  siteShareMetadata,
  socialImage,
} from "../lib/seo";
import {
  shareEventTitle,
  shareSiteDescription,
  shareSiteTitle,
} from "../lib/og";

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

test("share metadata uses Big Mama Fitness branding and dynamic OG routes", () => {
  const previous = process.env.APP_URL;
  process.env.APP_URL = "https://www.bigmamafit.ca";
  try {
    assert.equal(
      shareSiteTitle(initialEvent),
      "Afro Dance Fitness Nanaimo | Big Mama Fitness",
    );
    assert.match(shareSiteDescription(initialEvent), /\$10/);
    assert.match(shareSiteDescription(initialEvent), /November 21/);
    assert.match(shareEventTitle(initialEvent), /Nov 21/);
    const root = siteShareMetadata(initialEvent);
    assert.equal(root.openGraph?.url, "https://www.bigmamafit.ca/");
    assert.equal(root.openGraph?.siteName, "Big Mama Fitness");
    assert.equal(
      (root.openGraph as { type?: string } | undefined)?.type,
      "website",
    );
    assert.equal(
      (root.twitter as { card?: string } | undefined)?.card,
      "summary_large_image",
    );
    // File-convention OG routes own image tags; metadata must not pin a static /og PNG.
    assert.equal(root.openGraph?.images, undefined);
    assert.equal(
      (root.twitter as { images?: unknown } | undefined)?.images,
      undefined,
    );
    assert.equal(
      socialImage("/opengraph-image").url,
      "https://www.bigmamafit.ca/opengraph-image",
    );
    const event = eventMetadata(initialEvent);
    assert.equal(
      event.openGraph?.url,
      "https://www.bigmamafit.ca/event/afro-dance-fitness",
    );
    assert.equal(event.openGraph?.images, undefined);
    assert.equal(
      eventSchema(initialEvent, 0).image[0],
      "https://www.bigmamafit.ca/event/afro-dance-fitness/opengraph-image",
    );
    assert.equal(
      (event.twitter as { card?: string } | undefined)?.card,
      "summary_large_image",
    );
  } finally {
    if (previous === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = previous;
  }
});

test("structured data cannot terminate its script element", () => {
  assert.equal(
    safeJson({ name: "</script><script>alert(1)</script>" }).includes("<"),
    false,
  );
});
