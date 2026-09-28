import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const displayName = process.argv[4];
  if (!email || !password) {
    throw new Error(
      "Usage: npm run admin:create -- email password [displayName]",
    );
  }
  if (password.length < 8) throw new Error("Use at least 8 characters.");
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const secret = process.env.CRON_SECRET;
  if (!url || !secret || secret.length < 32)
    throw new Error("Set NEXT_PUBLIC_CONVEX_URL and CRON_SECRET first.");
  const client = new ConvexHttpClient(url);
  const result = await client.mutation(api.auth.createOrganizer, {
    email,
    password,
    ...(displayName ? { displayName } : {}),
    setupSecret: secret,
  });
  console.log(
    result.created
      ? "Organizer created for " + email
      : "Organizer already exists for " + email,
  );
  console.log("Public signup stays closed. Sign in at /login.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
