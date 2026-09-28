import { defineApp } from "convex/server";
import { v } from "convex/values";
import betterAuth from "@convex-dev/better-auth/convex.config";

const app = defineApp({
  env: {
    // TODO: After the app is stable, stage a rename to INTERNAL_API_SECRET.
    // Not a cron secret. Shared Next.js-to-Convex secret. Server-only.
    // Never use a NEXT_PUBLIC_ prefix. Same value on Next.js and Convex. Minimum 32 characters.
    CRON_SECRET: v.string(),
    BETTER_AUTH_SECRET: v.string(),
    SITE_URL: v.string(),
  },
});
app.use(betterAuth);

export default app;
