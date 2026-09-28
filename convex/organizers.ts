import { query } from "./_generated/server";
import { v } from "convex/values";
import { fail, assertInternal } from "./errors";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export async function organizerByAuthUserId(
  ctx: QueryCtx | MutationCtx,
  authUserId: string,
) {
  return ctx.db
    .query("organizers")
    .withIndex("by_auth_user_id", (q) => q.eq("authUserId", authUserId))
    .unique();
}

export async function requireActiveOrganizer(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) fail("Sign in to continue.", 401);
  const row = await organizerByAuthUserId(ctx, identity.subject);
  if (!row || !row.isActive) fail("Organizer access required.", 403);
  return row;
}

export async function insertOrganizer(
  ctx: MutationCtx,
  args: {
    authUserId: string;
    email: string;
    displayName: string;
  },
) {
  const now = new Date().toISOString();
  const existingEmail = await ctx.db
    .query("organizers")
    .withIndex("by_email", (q) => q.eq("email", args.email))
    .unique();
  if (existingEmail) return existingEmail;
  const existingUser = await organizerByAuthUserId(ctx, args.authUserId);
  if (existingUser) return existingUser;
  await ctx.db.insert("organizers", {
    authUserId: args.authUserId,
    email: args.email,
    displayName: args.displayName,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
}

export const currentOrganizer = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const row = await organizerByAuthUserId(ctx, identity.subject);
    if (!row || !row.isActive) return null;
    return {
      authUserId: row.authUserId,
      email: row.email,
      displayName: row.displayName,
    };
  },
});

export const activeEmails = query({
  args: { internalSecret: v.string() },
  handler: async (ctx, { internalSecret }) => {
    assertInternal(internalSecret);
    const rows = await ctx.db.query("organizers").collect();
    return rows.filter((row) => row.isActive).map((row) => row.email);
  },
});
