/**
 * Dev-only: remove duplicate pending unpaid checkout attendees.
 *
 * Groups by event + email. Keeps the oldest pending row. Deletes newer
 * pending duplicates and releases their holds. Never touches paid rows.
 *
 * Usage:
 *   npx tsx --env-file-if-exists=.env.local scripts/dedupe-pending-attendees.ts
 *   npx tsx --env-file-if-exists=.env.local scripts/dedupe-pending-attendees.ts --apply
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { initialEvent } from "../lib/event";

async function main() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const secret = process.env.CRON_SECRET;
  if (!url || !secret || secret.length < 32)
    throw new Error("Set NEXT_PUBLIC_CONVEX_URL and CRON_SECRET first.");

  const apply = process.argv.includes("--apply");
  const eventArg = process.argv.find((arg) => arg.startsWith("--event="));
  const eventId = eventArg?.slice("--event=".length) || initialEvent.id;

  const client = new ConvexHttpClient(url);
  const result = await client.mutation(api.booking.dedupePendingCheckouts, {
    eventId,
    internalSecret: secret,
    dryRun: !apply,
  });

  console.log(JSON.stringify(result, null, 2));
  if (!apply)
    console.log("Dry run only. Pass --apply to delete duplicate pending rows.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
