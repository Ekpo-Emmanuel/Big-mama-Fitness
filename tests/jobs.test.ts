import { test } from "vitest";
import assert from "node:assert/strict";
import { harness } from "./harness";
import { prepareSendHandler } from "../convex/jobs";

test("prepare delivers once and retry preserves job identity", async () => {
  const t = harness();
  await t.mutation(async (ctx) => {
    await ctx.db.insert("jobs", {
      jobId: "one",
      kind: "test",
      attendeeId: null,
      payload: "{}",
      dueAt: 0,
      status: "pending",
      attempts: 0,
      lockedUntil: 0,
      lastError: null,
    });
  });
  const first = await t.mutation((ctx) => prepareSendHandler(ctx, "one", 1000));
  assert.ok(first);
  await t.mutation(async (ctx) => {
    const row = await ctx.db
      .query("jobs")
      .withIndex("by_job_id", (q) => q.eq("jobId", "one"))
      .unique();
    await ctx.db.patch(row!._id, {
      status: "pending",
      lockedUntil: 0,
      dueAt: 62000,
      lastError: "Delivery failed; retry scheduled",
    });
  });
  const second = await t.mutation((ctx) => prepareSendHandler(ctx, "one", 62000));
  assert.equal(second?.jobId, "one");
  await t.mutation(async (ctx) => {
    const row = await ctx.db
      .query("jobs")
      .withIndex("by_job_id", (q) => q.eq("jobId", "one"))
      .unique();
    await ctx.db.patch(row!._id, {
      status: "sent",
      lockedUntil: 0,
      lastError: null,
    });
  });
  const third = await t.mutation((ctx) => prepareSendHandler(ctx, "one", 63000));
  assert.equal(third, null);
});

test("two prepares cannot claim the same pending job", async () => {
  const t = harness();
  await t.mutation(async (ctx) => {
    await ctx.db.insert("jobs", {
      jobId: "race",
      kind: "test",
      attendeeId: null,
      payload: "{}",
      dueAt: 0,
      status: "pending",
      attempts: 0,
      lockedUntil: 0,
      lastError: null,
    });
  });
  const results = await Promise.all([
    t.mutation((ctx) => prepareSendHandler(ctx, "race", 1000)),
    t.mutation((ctx) => prepareSendHandler(ctx, "race", 1000)),
  ]);
  const claimed = results.filter(Boolean);
  assert.equal(claimed.length, 1);
  assert.equal(claimed[0]?.jobId, "race");
});

test("stale ambiguous delivery is held for review instead of duplicated", async () => {
  const t = harness();
  await t.mutation(async (ctx) => {
    await ctx.db.insert("jobs", {
      jobId: "old",
      kind: "test",
      attendeeId: null,
      payload: JSON.stringify({ firstAttemptAt: 1 }),
      dueAt: 0,
      status: "pending",
      attempts: 0,
      lockedUntil: 0,
      lastError: null,
    });
  });
  const job = await t.mutation((ctx) =>
    prepareSendHandler(ctx, "old", 24 * 60 * 60 * 1000),
  );
  assert.equal(job, null);
  const status = await t.query(async (ctx) => {
    const row = await ctx.db
      .query("jobs")
      .withIndex("by_job_id", (q) => q.eq("jobId", "old"))
      .unique();
    return row!.status;
  });
  assert.equal(status, "needs_review");
});
