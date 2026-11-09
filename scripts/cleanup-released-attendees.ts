/**
 * Delete named unpaid cancelled/released attendees. Keeps one held row.
 * Never deletes paid/sold/held targets (server enforces).
 *
 * Usage:
 *   npx tsx --env-file=.env.production scripts/cleanup-released-attendees.ts --dry-run
 *   npx tsx --env-file=.env.production scripts/cleanup-released-attendees.ts --apply
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const EVENT_ID = "afro-nov-2026";
const KEEP = "adf910b3-bc4c-4503-865b-2ce523c5943e";
const DELETE = [
  "6b39c5f0-8bd6-4be2-a060-0a422f251629",
  "dc6d4f9b-2a95-4420-b77c-e6e3bab85047",
  "974d9cf9-3812-4fdc-89dd-7dd3a1af07fc",
];

async function main() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const secret = process.env.CRON_SECRET;
  if (!url || !secret || secret.length < 32) {
    throw new Error("Set NEXT_PUBLIC_CONVEX_URL and CRON_SECRET first.");
  }

  const apply = process.argv.includes("--apply");
  const dryRun = !apply;
  if (!apply && !process.argv.includes("--dry-run")) {
    throw new Error("Pass --dry-run or --apply.");
  }

  const client = new ConvexHttpClient(url);
  const result = await client.mutation(api.booking.deleteReleasedAttendeesById, {
    eventId: EVENT_ID,
    keepAttendeeId: KEEP,
    attendeeIds: DELETE,
    internalSecret: secret,
    dryRun,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
