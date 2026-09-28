import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { initialEvent } from "../lib/event";

async function main() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const secret = process.env.CRON_SECRET;
  if (!url || !secret || secret.length < 32)
    throw new Error("Set NEXT_PUBLIC_CONVEX_URL and CRON_SECRET first.");
  const client = new ConvexHttpClient(url);
  await client.mutation(api.events.ensureSeeded, {});
  const event =
    (await client.query(api.events.get, { key: initialEvent.id })) ??
    initialEvent;
  if (event.waiverText && event.waiverVersion) {
    console.log("Waiver already present. Booking can open once Stripe env is set.");
    return;
  }
  const updated = {
    ...event,
    waiverVersion: "local-test-v1",
    waiverText:
      "LOCAL TEST WAIVER ONLY. Not a legal document. Used for Stripe test-mode checkout on this development deployment.",
  };
  await client.mutation(api.events.saveConfig, {
    inputJson: JSON.stringify(updated),
    internalSecret: secret,
  });
  console.log("Wrote local-test waiver on " + event.id + ". Replace before production.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
