/**
 * DEV-only: seed compressed reminder/follow-up schedule and watch delivery.
 *
 * Does NOT change production schedule constants.
 * Does NOT touch production Convex deployment (requires CONVEX_DEPLOYMENT=dev:...).
 *
 * Usage:
 *   npm run dev:email-schedule -- --to=you@example.com
 *   npm run dev:email-schedule -- --to=you@example.com --watch-ms=700000
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { initialEvent } from "../lib/event";
import { productionReminderInstants } from "../lib/email/dev-compressed-schedule";

function argValue(name: string) {
  const hit = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : "";
}

function fmtZone(ms: number, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(new Date(ms));
}

function reportProductionTimes() {
  const instants = productionReminderInstants(
    initialEvent.startsAt,
    initialEvent.endsAt,
  );
  console.log("\n=== Real event send times (production constants) ===");
  console.log(
    `Event: Saturday, November 21, 2026 · 5:30 PM–6:30 PM · ${initialEvent.timezone}`,
  );
  for (const [label, ms] of [
    ["24h reminder", instants.reminder_24],
    ["3h reminder", instants.reminder_3],
    ["2h post-event follow-up", instants.followup],
  ] as const) {
    console.log(`\n${label}`);
    console.log(`  Pacific: ${fmtZone(ms, "America/Vancouver")}`);
    console.log(`  UTC:     ${new Date(ms).toISOString()}`);
  }
}

async function main() {
  const deployment = process.env.CONVEX_DEPLOYMENT || "";
  if (!deployment.startsWith("dev:")) {
    throw new Error(
      `Refusing to run: CONVEX_DEPLOYMENT must be dev:* (got "${deployment}")`,
    );
  }
  if (process.env.EMAIL_PRODUCTION === "true") {
    throw new Error("Refusing to run with EMAIL_PRODUCTION=true");
  }

  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const secret = process.env.CRON_SECRET;
  const to = argValue("--to") || process.env.EMAIL_SCHEDULE_TEST_TO || "";
  const watchMs = Number(argValue("--watch-ms") || 12 * 60 * 1000);
  if (!url || !secret || secret.length < 32)
    throw new Error("Set NEXT_PUBLIC_CONVEX_URL and CRON_SECRET first.");
  if (!to.includes("@"))
    throw new Error("Pass --to=you@example.com (inbox you control).");

  reportProductionTimes();

  const client = new ConvexHttpClient(url);
  console.log("\n=== Seeding DEV compressed probe ===");
  const seeded = await client.mutation(api.devEmailSchedule.seedProbe, {
    internalSecret: secret,
    email: to,
  });
  console.log(JSON.stringify(seeded, null, 2));

  console.log("\n=== Cancel path: cancel second attendee before reminders ===");
  const cancelled = await client.mutation(api.devEmailSchedule.cancelProbeGuest, {
    internalSecret: secret,
    attendeeId: seeded.cancelAttendeeId,
  });
  console.log(JSON.stringify(cancelled, null, 2));

  const started = Date.now();
  let lastDump = "";
  console.log(`\n=== Watching jobs/deliveries for ${Math.round(watchMs / 1000)}s ===`);
  while (Date.now() - started < watchMs) {
    const status = await client.query(api.devEmailSchedule.probeStatus, {
      internalSecret: secret,
      keepAttendeeId: seeded.keepAttendeeId,
      cancelAttendeeId: seeded.cancelAttendeeId,
    });
    const dump = JSON.stringify(status, null, 2);
    if (dump !== lastDump) {
      console.log(`\n[${new Date().toISOString()}] status update`);
      console.log(dump);
      lastDump = dump;
    }

    const keepJobs = status.jobs.filter(
      (job) => job && job.attendeeId === seeded.keepAttendeeId,
    );
    const allKeepTerminal = keepJobs.every(
      (job) => job && ["sent", "skipped", "needs_review"].includes(job.status),
    );
    if (allKeepTerminal && keepJobs.length === 3) {
      console.log("\nKeep-attendee jobs reached terminal states.");
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 15_000));
  }

  const finalStatus = await client.query(api.devEmailSchedule.probeStatus, {
    internalSecret: secret,
    keepAttendeeId: seeded.keepAttendeeId,
    cancelAttendeeId: seeded.cancelAttendeeId,
  });

  console.log("\n=== Idempotency: re-prepare already-handled jobs ===");
  const idempotency = [];
  for (const job of finalStatus.jobs) {
    if (!job || job.attendeeId !== seeded.keepAttendeeId) continue;
    const result = await client.mutation(api.devEmailSchedule.tryPrepareSend, {
      internalSecret: secret,
      jobId: job.jobId,
    });
    idempotency.push({
      jobId: job.jobId,
      jobStatus: job.status,
      claimed: result.claimed,
      prepare: result.status,
    });
  }
  console.log(JSON.stringify(idempotency, null, 2));

  console.log("\n=== FINAL REPORT ===");
  console.log(
    JSON.stringify(
      {
        deployment,
        timeline: seeded.timeline,
        keepAttendeeId: seeded.keepAttendeeId,
        cancelAttendeeId: seeded.cancelAttendeeId,
        inbox: to,
        jobs: finalStatus.jobs,
        deliveries: finalStatus.deliveries,
        guests: finalStatus.guests.map((g) => ({
          id: g.id,
          email: g.email,
          attendee_status: g.attendee_status,
          payment_status: g.payment_status,
        })),
        idempotency,
        cancelJobsSkipped: finalStatus.jobs
          .filter((j) => j && j.attendeeId === seeded.cancelAttendeeId)
          .map((j) => ({ jobId: j!.jobId, status: j!.status })),
      },
      null,
      2,
    ),
  );
  console.log(
    "\nInbox check: confirm Keep Probe reminder_24, reminder_3, followup arrived.",
  );
  console.log(
    "Cancel Probe must have no reminder/follow-up mail (jobs skipped).",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
