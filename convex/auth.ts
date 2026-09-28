import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import { mutation, query, env } from "./_generated/server";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";
import { v } from "convex/values";
import { fail } from "./errors";
import { insertOrganizer } from "./organizers";
import { assertInternal } from "./events";

export const authComponent = createClient<DataModel>(
  components.betterAuth as never,
);

export const createAuth = (
  ctx: GenericCtx<DataModel>,
  opts?: { allowSignUp?: boolean },
) =>
  betterAuth({
    baseURL: env.SITE_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      disableSignUp: !opts?.allowSignUp,
      minPasswordLength: 8,
    },
    plugins: [convex({ authConfig })],
    trustedOrigins: env.SITE_URL ? [env.SITE_URL] : [],
  });

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.safeGetAuthUser(ctx);
  },
});

export const createOrganizer = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    displayName: v.optional(v.string()),
    setupSecret: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternal(args.setupSecret);
    if (args.password.length < 8)
      fail("Use at least 8 characters.", 400);
    const email = args.email.trim().toLowerCase();
    const displayName = (args.displayName || email.split("@")[0]).trim();
    const existingOrganizer = await ctx.db
      .query("organizers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existingOrganizer) return { email, created: false };

    const { auth } = await authComponent.getAuth(
      (inner) => createAuth(inner, { allowSignUp: true }),
      ctx,
    );

    async function userIdForEmail() {
      const existing = (await ctx.runQuery(
        components.betterAuth.adapter.findOne,
        {
          model: "user",
          where: [{ field: "email", value: email }],
        },
      )) as { _id?: string; id?: string } | null;
      return existing?._id || existing?.id;
    }

    let userId = await userIdForEmail();
    if (!userId) {
      try {
        const created = await auth.api.signUpEmail({
          body: {
            email,
            password: args.password,
            name: displayName,
          },
        });
        userId = created.user.id;
      } catch (error) {
        userId = await userIdForEmail();
        if (!userId) {
          const message =
            error instanceof Error
              ? error.message
              : "Could not create that account.";
          fail(message, 409);
        }
      }
    }
    if (!userId) fail("Could not create that account.", 409);
    await insertOrganizer(ctx, {
      authUserId: userId,
      email,
      displayName,
    });
    return { email, created: true };
  },
});
