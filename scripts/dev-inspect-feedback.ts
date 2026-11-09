/**
 * DEV-only: dump eventFeedback rows from Convex DEV.
 *   node --env-file-if-exists=.env.local --import tsx scripts/dev-inspect-feedback.ts
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function main() {
  const deployment = process.env.CONVEX_DEPLOYMENT || "";
  if (!deployment.startsWith("dev:")) {
    throw new Error(
      `Refusing: CONVEX_DEPLOYMENT must be dev:* (got "${deployment}")`,
    );
  }
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const secret = process.env.CRON_SECRET;
  if (!url || !secret || secret.length < 32)
    throw new Error("Missing Convex URL/CRON_SECRET");

  const client = new ConvexHttpClient(url);
  const rows = await client.query(api.feedback.dumpAll, {
    internalSecret: secret,
  });
  console.log(`Deployment: ${deployment}`);
  console.log(`eventFeedback rows: ${rows.length}`);
  console.log(JSON.stringify(rows, null, 2));

  for (const key of [
    "followup-email-probe",
    "afro-nov-2026",
    "afro-dance-fitness",
  ]) {
    const event = await client.query(api.events.get, { key });
    console.log(
      `\nkey=${key} →`,
      event ? { id: event.id, slug: event.slug, name: event.name } : null,
    );
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
