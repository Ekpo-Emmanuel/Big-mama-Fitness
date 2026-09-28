import { ConvexError } from "convex/values";
import { env } from "./_generated/server";

export function fail(message: string, status = 400): never {
  throw new ConvexError({ message, status });
}

// TODO: After the app is stable, stage a rename to INTERNAL_API_SECRET.
// CRON_SECRET is the shared Next.js-to-Convex secret, not a cron secret.
// Server-only. Never use a NEXT_PUBLIC_ prefix. Same value on Next.js and Convex. Minimum 32 characters.
export function assertInternal(secret: string) {
  const expected = env.CRON_SECRET;
  if (!expected || expected.length < 32 || secret !== expected)
    fail("Unauthorized.", 401);
}
