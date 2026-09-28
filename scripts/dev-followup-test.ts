/**
 * DEV-only: schedule one follow-up email (+delay) with Rate the class CTA.
 *
 * Does NOT change production schedule constants.
 * Does NOT schedule 24h/3h reminders.
 * Does NOT touch production Convex (requires CONVEX_DEPLOYMENT=dev:...).
 *
 * Usage:
 *   npm run dev:followup-test -- --to=you@example.com
 *   npm run dev:followup-test -- --to=you@example.com --delay=2m
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

function argValue(name: string) {
  const hit = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : "";
}

function parseDelayMinutes(raw: string) {
  if (!raw) return 2;
  const match = raw.trim().match(/^(\d+)\s*m?$/i);
  if (!match) throw new Error(`Bad --delay=${raw} (use e.g. 2m or 2)`);
  return Math.max(1, Number(match[1]));
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const to = argValue("--to") || process.env.EMAIL_FOLLOWUP_TEST_TO || "";
  const delayMinutes = parseDelayMinutes(argValue("--delay") || "2m");
  const watchMs = Number(
    argValue("--watch-ms") || (delayMinutes + 2) * 60 * 1000,
  );
  if (!url || !secret || secret.length < 32)
    throw new Error("Set NEXT_PUBLIC_CONVEX_URL and CRON_SECRET first.");
  if (!to.includes("@"))
    throw new Error("Pass --to=you@example.com (inbox you control).");

  const client = new ConvexHttpClient(url);
  console.log("\n=== Seed DEV follow-up-only probe ===");
  console.log(`Deployment: ${deployment}`);
  console.log(`To: ${to}`);
  console.log(`Delay: ${delayMinutes}m`);

  const seeded = await client.mutation(api.devEmailSchedule.seedFollowupProbe, {
    internalSecret: secret,
    email: to,
    delayMinutes,
  });
  console.log(JSON.stringify(seeded, null, 2));

  if (!seeded.feedbackToken)
    throw new Error("feedbackToken missing on seeded attendee");
  if (!seeded.job.scheduledFunctionId)
    throw new Error("scheduledFunctionId missing on follow-up job");

  console.log("\n=== Feedback URL (open after email, or now) ===");
  console.log(seeded.feedbackUrl);
  console.log(
    `Due (Pacific): ${fmtZone(seeded.job.dueAt, "America/Vancouver")}`,
  );
  console.log(`Due (UTC):     ${new Date(seeded.job.dueAt).toISOString()}`);

  const started = Date.now();
  let lastDump = "";
  let sent = false;
  console.log(
    `\n=== Watching follow-up job for ${Math.round(watchMs / 1000)}s ===`,
  );
  while (Date.now() - started < watchMs) {
    const status = await client.query(
      api.devEmailSchedule.followupProbeStatus,
      {
        internalSecret: secret,
        attendeeId: seeded.attendeeId,
      },
    );
    const dump = JSON.stringify(status, null, 2);
    if (dump !== lastDump) {
      console.log(`\n[${new Date().toISOString()}] status update`);
      console.log(dump);
      lastDump = dump;
    }
    if (status.job?.status === "sent") {
      sent = true;
      break;
    }
    if (status.job?.status === "failed" || status.job?.status === "skipped") {
      throw new Error(
        `Follow-up ended as ${status.job.status}: ${status.job.lastError}`,
      );
    }
    await sleep(5000);
  }

  const finalStatus = await client.query(
    api.devEmailSchedule.followupProbeStatus,
    {
      internalSecret: secret,
      attendeeId: seeded.attendeeId,
    },
  );

  console.log("\n=== Submit sample feedback (admin visibility check) ===");
  // Opt-in only — default leaves form clean for real guest click path.
  const shouldSubmitSample = process.argv.includes("--submit-sample");
  let afterSubmit = finalStatus;
  if (shouldSubmitSample) {
    const submitted = await client.mutation(api.feedback.submit, {
      eventId: seeded.eventId,
      input: {
        token: seeded.feedbackToken,
        rating: 5,
        sentiment: "loved",
        enjoyedMost: "DEV follow-up probe sample",
        improvement: "",
      },
    });
    console.log(JSON.stringify(submitted, null, 2));
    afterSubmit = await client.query(api.devEmailSchedule.followupProbeStatus, {
      internalSecret: secret,
      attendeeId: seeded.attendeeId,
    });
  } else {
    console.log("Skipped (pass --submit-sample to write a sample admin row).");
  }

  console.log("\n=== REPORT ===");
  console.log(`eventId:              ${seeded.eventId}`);
  console.log(`slug:                 ${seeded.slug}`);
  console.log(`attendeeId:           ${seeded.attendeeId}`);
  console.log(`feedbackToken:        ${seeded.feedbackToken}`);
  console.log(`scheduledFunctionId:  ${seeded.job.scheduledFunctionId}`);
  console.log(
    `dueAt:                ${new Date(seeded.job.dueAt).toISOString()}`,
  );
  console.log(
    `sentAt:               ${
      finalStatus.job?.sentAt
        ? new Date(finalStatus.job.sentAt).toISOString()
        : "NOT YET"
    }`,
  );
  console.log(`job status:           ${finalStatus.job?.status}`);
  console.log(
    `Resend provider id:   ${finalStatus.job?.providerMessageId ?? "none"}`,
  );
  console.log(
    `emailDeliveries:      ${finalStatus.deliveries.length} row(s) · ${
      finalStatus.deliveries.map((d) => d.status).join(",") || "none"
    }`,
  );
  console.log(
    `reminder jobs:        ${
      finalStatus.reminderJobsScheduled.length === 0
        ? "none (good)"
        : JSON.stringify(finalStatus.reminderJobsScheduled)
    }`,
  );
  console.log(`feedback URL:         ${seeded.feedbackUrl}`);
  console.log(
    `admin feedback row:   ${
      afterSubmit.feedbackRow
        ? `${afterSubmit.feedbackRow.rating}/5 · ${afterSubmit.feedbackRow.sentiment}`
        : shouldSubmitSample
          ? "missing"
          : "none yet (guest submit via Rate the class)"
    }`,
  );
  console.log(
    `inbox:                check ${to} for "Thanks for bringing the energy" / Rate the class`,
  );
  console.log(
    `Admin path:           /admin/events/${seeded.eventId}/feedback`,
  );
  if (!sent) {
    console.log(
      "\nWARN: watch window ended before status=sent. Re-query later or raise --watch-ms.",
    );
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
