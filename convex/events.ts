import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { initialEvent, octoberEvent, type DanceEvent } from "../lib/event";
import { eventConfigSchema } from "../lib/event-config";
import { assertInternal, fail } from "./errors";
import { fromDanceEvent, toDanceEvent } from "./map";
import { requireActiveOrganizer } from "./organizers";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const FEATURED_KEY = "default";

function parseDanceEvent(input: unknown): DanceEvent {
  const parsed = eventConfigSchema.safeParse(input);
  if (!parsed.success)
    fail(
      parsed.error.issues[0]?.message ||
        "Check the event details and try again.",
    );
  return parsed.data;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function preferEventRow<T extends { eventId: string; status: string; registrationOpen: boolean; startsAt: string }>(
  rows: T[],
) {
  return [...rows].sort((a, b) => {
    const score = (row: T) =>
      (row.eventId === initialEvent.id ? 100 : 0) +
      (row.eventId === octoberEvent.id ? -20 : 0) +
      (row.status === "published" ? 10 : 0) +
      (row.registrationOpen ? 5 : 0);
    return score(b) - score(a) || Date.parse(b.startsAt) - Date.parse(a.startsAt);
  })[0];
}

async function eventsByEventId(ctx: QueryCtx | MutationCtx, eventId: string) {
  return ctx.db
    .query("events")
    .withIndex("by_event_id", (q) => q.eq("eventId", eventId))
    .collect();
}

async function eventsBySlug(ctx: QueryCtx | MutationCtx, slug: string) {
  return ctx.db
    .query("events")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .collect();
}

async function upsertEventRow(ctx: MutationCtx, event: DanceEvent) {
  const existing = preferEventRow(await eventsByEventId(ctx, event.id));
  if (existing) return existing;
  const slugOwner = preferEventRow(await eventsBySlug(ctx, event.slug));
  if (slugOwner && slugOwner.eventId !== event.id) {
    await ctx.db.patch(slugOwner._id, {
      slug: `${slugOwner.slug}-${slugOwner.eventId}`,
      updatedAt: new Date().toISOString(),
    });
  }
  const id = await ctx.db.insert("events", fromDanceEvent(event));
  return (await ctx.db.get(id))!;
}

async function getFeaturedSettings(ctx: QueryCtx | MutationCtx) {
  const rows = await ctx.db
    .query("siteSettings")
    .withIndex("by_key", (q) => q.eq("key", FEATURED_KEY))
    .collect();
  return rows[0] ?? null;
}

export async function findEvent(ctx: QueryCtx | MutationCtx, key: string) {
  const byId = await eventsByEventId(ctx, key);
  if (byId.length) return preferEventRow(byId);
  const bySlug = await eventsBySlug(ctx, key);
  if (bySlug.length) return preferEventRow(bySlug);
  return null;
}

async function repairDuplicateSlugs(ctx: MutationCtx) {
  const all = await ctx.db.query("events").collect();
  for (const row of all) {
    if (row.eventId === octoberEvent.id && row.slug === initialEvent.slug) {
      await ctx.db.patch(row._id, {
        slug: octoberEvent.slug,
        status: "completed",
        registrationOpen: false,
        updatedAt: new Date().toISOString(),
      });
    }
  }
  const marketing = await eventsBySlug(ctx, initialEvent.slug);
  if (marketing.length <= 1) return;
  const keep =
    marketing.find((row) => row.eventId === initialEvent.id) ??
    preferEventRow(marketing);
  for (const row of marketing) {
    if (row._id === keep._id) continue;
    const slug =
      row.eventId === octoberEvent.id
        ? octoberEvent.slug
        : `${initialEvent.slug}-${row.eventId}`;
    await ctx.db.patch(row._id, {
      slug,
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function seedIfNeeded(ctx: MutationCtx) {
  await repairDuplicateSlugs(ctx);
  const october = await upsertEventRow(ctx, octoberEvent);
  const november = await upsertEventRow(ctx, initialEvent);

  const needsApprovedWaiver =
    !november.waiverText ||
    !november.waiverVersion ||
    november.waiverVersion === "local-test-v1" ||
    november.waiverText.includes("LOCAL TEST WAIVER ONLY");
  if (
    needsApprovedWaiver &&
    initialEvent.waiverText &&
    initialEvent.waiverVersion
  ) {
    await ctx.db.patch(november._id, {
      waiverVersion: initialEvent.waiverVersion,
      waiverText: initialEvent.waiverText,
      updatedAt: new Date().toISOString(),
    });
  }

  const featured = await getFeaturedSettings(ctx);
  if (!featured) {
    await ctx.db.insert("siteSettings", {
      key: FEATURED_KEY,
      featuredEventId: initialEvent.id,
      updatedAt: new Date().toISOString(),
    });
  }

  void october;
  return (await ctx.db
    .query("events")
    .withIndex("by_event_id", (q) => q.eq("eventId", initialEvent.id))
    .unique())!;
}

export const ensureSeeded = mutation({
  args: {},
  handler: async (ctx) => {
    await seedIfNeeded(ctx);
  },
});

export const get = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const row = await findEvent(ctx, key);
    if (row) return toDanceEvent(row);
    if (key === initialEvent.id || key === initialEvent.slug) return initialEvent;
    if (key === octoberEvent.id || key === octoberEvent.slug) return octoberEvent;
    return null;
  },
});

export const featured = query({
  args: {},
  handler: async (ctx) => {
    const settings = await getFeaturedSettings(ctx);
    if (settings) {
      const row = await findEvent(ctx, settings.featuredEventId);
      if (row) return toDanceEvent(row);
    }
    const byId = await findEvent(ctx, initialEvent.id);
    if (byId) return toDanceEvent(byId);
    const published = await ctx.db.query("events").collect();
    const open = published
      .filter((row) => row.isPublished && row.status === "published")
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];
    if (open) return toDanceEvent(open);
    return initialEvent;
  },
});

export const inventory = query({
  args: { eventId: v.string() },
  handler: async (ctx, { eventId }) => {
    const row = await findEvent(ctx, eventId);
    if (!row) return { sold: 0, held: 0 };
    return { sold: row.soldCount, held: row.heldCount };
  },
});

export const listPublished = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("events").collect();
    const published = rows
      .filter((row) => row.isPublished && row.status !== "draft")
      .map((row) => ({
        event: toDanceEvent(row),
        updatedAt: row.updatedAt,
      }));
    if (published.length) return published;
    if (initialEvent.isPublished && initialEvent.status !== "draft")
      return [{ event: initialEvent, updatedAt: initialEvent.startsAt }];
    return [];
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireActiveOrganizer(ctx);
    const rows = await ctx.db.query("events").collect();
    return rows.map(toDanceEvent);
  },
});

export const overview = query({
  args: { eventId: v.string() },
  handler: async (ctx, { eventId }) => {
    await requireActiveOrganizer(ctx);
    const event = await findEvent(ctx, eventId);
    if (!event) return null;
    const attendees = await ctx.db
      .query("attendees")
      .withIndex("by_event", (q) => q.eq("eventId", event.eventId))
      .collect();
    const leads = await ctx.db
      .query("futureEventLeads")
      .withIndex("by_source_event", (q) => q.eq("sourceEventId", event.eventId))
      .collect();
    const jobs = await ctx.db.query("jobs").collect();
    let expected = 0,
      checked = 0,
      absent = 0,
      cancelled = 0,
      gross = 0,
      net = 0;
    for (const row of attendees) {
      if (
        ["confirmed", "checked_in"].includes(row.attendeeStatus) &&
        row.paymentStatus === "paid"
      )
        expected++;
      if (row.attendeeStatus === "checked_in") checked++;
      if (row.attendeeStatus === "no_show") absent++;
      if (row.attendeeStatus === "cancelled") cancelled++;
      if (row.inventoryStatus === "sold") gross += row.amountPaidCents;
      if (row.paymentStatus === "paid") net += row.amountPaidCents;
    }
    return {
      event: toDanceEvent(event),
      sold: event.soldCount,
      held: event.heldCount,
      expected,
      checked,
      absent,
      cancelled,
      gross,
      net,
      leads: leads.length,
      jobs: jobs.filter((job) => job.status !== "sent" && job.status !== "skipped")
        .length,
    };
  },
});

export const saveConfig = mutation({
  args: { inputJson: v.string(), internalSecret: v.string() },
  handler: async (ctx, { inputJson, internalSecret }) => {
    assertInternal(internalSecret);
    const event = parseDanceEvent(JSON.parse(inputJson));
    const existing = await findEvent(ctx, event.id);
    const sold = existing?.soldCount ?? 0;
    const held = existing?.heldCount ?? 0;
    if (held > 0)
      throw new Error(
        "Resolve active Stripe checkouts before changing event configuration.",
      );
    if (sold > event.capacity)
      throw new Error("Capacity cannot be lower than tickets already sold.");
    const payload = fromDanceEvent(event, {
      soldCount: sold,
      heldCount: held,
      updatedAt: new Date().toISOString(),
    });
    if (existing) {
      const slugOwner = preferEventRow(await eventsBySlug(ctx, event.slug));
      if (slugOwner && slugOwner.eventId !== existing.eventId)
        fail("That public URL is already used by another event.", 409);
      await ctx.db.patch(existing._id, payload);
    } else {
      const slugOwner = preferEventRow(await eventsBySlug(ctx, event.slug));
      if (slugOwner) fail("That public URL is already used by another event.", 409);
      await ctx.db.insert("events", payload);
    }
    if (event.id === initialEvent.id && event.status === "published") {
      const featured = await getFeaturedSettings(ctx);
      const now = new Date().toISOString();
      if (featured)
        await ctx.db.patch(featured._id, {
          featuredEventId: event.id,
          updatedAt: now,
        });
      else
        await ctx.db.insert("siteSettings", {
          key: FEATURED_KEY,
          featuredEventId: event.id,
          updatedAt: now,
        });
    }
    return event;
  },
});

export const duplicateEvent = mutation({
  args: {
    sourceEventId: v.string(),
    startsAt: v.string(),
    endsAt: v.string(),
    workoutStartsAt: v.string(),
    workoutEndsAt: v.string(),
    name: v.optional(v.string()),
    venueName: v.optional(v.string()),
    addressLine1: v.optional(v.string()),
    city: v.optional(v.string()),
    province: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    capacity: v.optional(v.number()),
    targetAttendance: v.optional(v.number()),
    priceCents: v.optional(v.number()),
    instructorName: v.optional(v.string()),
    instructorBio: v.optional(v.string()),
    waiverVersion: v.optional(v.string()),
    waiverText: v.optional(v.string()),
    publish: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireActiveOrganizer(ctx);
    const source = await findEvent(ctx, args.sourceEventId);
    if (!source) fail("Event not found.", 404);
    const sourceEvent = toDanceEvent(source);
    const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    let eventId = `class-${stamp}`;
    let n = 1;
    while ((await eventsByEventId(ctx, eventId)).length) {
      n += 1;
      eventId = `class-${stamp}-${n}`;
    }
    const day = args.startsAt.slice(0, 10);
    let slug = slugify(`${sourceEvent.shortName}-${day}`) || eventId;
    let slugN = 1;
    while ((await eventsBySlug(ctx, slug)).length) {
      slugN += 1;
      slug = `${slugify(`${sourceEvent.shortName}-${day}`)}-${slugN}`;
    }
    const publish = args.publish ?? false;
    const next: DanceEvent = parseDanceEvent({
      ...sourceEvent,
      id: eventId,
      slug,
      name: args.name ?? sourceEvent.name,
      venueName: args.venueName ?? sourceEvent.venueName,
      addressLine1: args.addressLine1 || sourceEvent.addressLine1,
      city: args.city || sourceEvent.city,
      province: args.province || sourceEvent.province,
      postalCode: args.postalCode || sourceEvent.postalCode,
      capacity: args.capacity ?? sourceEvent.capacity,
      targetAttendance: args.targetAttendance ?? sourceEvent.targetAttendance,
      priceCents: args.priceCents ?? sourceEvent.priceCents,
      instructorName: args.instructorName ?? sourceEvent.instructorName,
      instructorBio: args.instructorBio ?? sourceEvent.instructorBio,
      waiverVersion: args.waiverVersion ?? sourceEvent.waiverVersion,
      waiverText: args.waiverText ?? sourceEvent.waiverText,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      workoutStartsAt: args.workoutStartsAt,
      workoutEndsAt: args.workoutEndsAt,
      status: publish ? "published" : "draft",
      isPublished: publish,
      registrationOpen: publish,
    });
    await ctx.db.insert("events", fromDanceEvent(next));
    return next;
  },
});

const eventStatus = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("sold_out"),
  v.literal("completed"),
  v.literal("cancelled"),
);

export const updateEvent = mutation({
  args: {
    eventId: v.string(),
    slug: v.string(),
    name: v.string(),
    shortName: v.string(),
    headline: v.string(),
    subheadline: v.string(),
    description: v.string(),
    startsAt: v.string(),
    endsAt: v.string(),
    workoutStartsAt: v.string(),
    workoutEndsAt: v.string(),
    venueName: v.string(),
    addressLine1: v.string(),
    city: v.string(),
    province: v.string(),
    postalCode: v.string(),
    capacity: v.number(),
    targetAttendance: v.number(),
    priceCents: v.number(),
    instructorName: v.string(),
    instructorBio: v.string(),
    contactEmail: v.string(),
    status: eventStatus,
    isPublished: v.boolean(),
    registrationOpen: v.boolean(),
    waiverVersion: v.string(),
    waiverText: v.string(),
  },
  handler: async (ctx, args) => {
    await requireActiveOrganizer(ctx);
    const existing = await findEvent(ctx, args.eventId);
    if (!existing) fail("Event not found.", 404);
    if (existing.heldCount > 0)
      fail("Resolve active Stripe checkouts before changing event details.", 409);
    if (existing.soldCount > args.capacity)
      fail("Capacity cannot be lower than tickets already sold.", 409);
    const slug = slugify(args.slug) || existing.slug;
    const slugOwner = preferEventRow(await eventsBySlug(ctx, slug));
    if (slugOwner && slugOwner.eventId !== existing.eventId)
      fail("That public URL is already used by another event.", 409);
    const current = toDanceEvent(existing);
    const next = parseDanceEvent({
      ...current,
      slug,
      name: args.name,
      shortName: args.shortName,
      headline: args.headline,
      subheadline: args.subheadline,
      description: args.description,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      workoutStartsAt: args.workoutStartsAt,
      workoutEndsAt: args.workoutEndsAt,
      venueName: args.venueName,
      addressLine1: args.addressLine1,
      city: args.city,
      province: args.province,
      postalCode: args.postalCode,
      capacity: args.capacity,
      targetAttendance: args.targetAttendance,
      priceCents: args.priceCents,
      instructorName: args.instructorName,
      instructorBio: args.instructorBio,
      contactEmail: args.contactEmail,
      status: args.status,
      isPublished: args.isPublished,
      registrationOpen: args.registrationOpen,
      waiverVersion: args.waiverVersion,
      waiverText: args.waiverText,
    });
    await ctx.db.patch(
      existing._id,
      fromDanceEvent(next, {
        soldCount: existing.soldCount,
        heldCount: existing.heldCount,
        updatedAt: new Date().toISOString(),
      }),
    );
    return next;
  },
});

export const deleteEvent = mutation({
  args: { eventId: v.string() },
  handler: async (ctx, { eventId }) => {
    await requireActiveOrganizer(ctx);
    const row = await findEvent(ctx, eventId);
    if (!row) fail("Event not found.", 404);
    if (row.eventId === initialEvent.id || row.eventId === octoberEvent.id)
      fail("This template class cannot be deleted. Create a new date instead.", 409);
    if (Date.parse(row.startsAt) <= Date.now())
      fail("Only upcoming events can be deleted.", 409);
    if (row.status === "completed")
      fail("Completed events cannot be deleted.", 409);
    if (row.heldCount > 0)
      fail("Wait for active Stripe checkouts to expire before deleting.", 409);
    const attendees = await ctx.db
      .query("attendees")
      .withIndex("by_event", (q) => q.eq("eventId", row.eventId))
      .collect();
    if (
      row.soldCount > 0 ||
      attendees.some(
        (guest) =>
          guest.paymentStatus === "paid" || guest.inventoryStatus === "sold",
      )
    )
      fail(
        "Refund or cancel paid guests before deleting this event.",
        409,
      );
    for (const guest of attendees) {
      const checkouts = await ctx.db
        .query("checkoutRecords")
        .withIndex("by_attendee", (q) => q.eq("attendeeId", guest.attendeeId))
        .collect();
      for (const checkout of checkouts) await ctx.db.delete(checkout._id);
      const jobs = await ctx.db
        .query("jobs")
        .withIndex("by_attendee", (q) => q.eq("attendeeId", guest.attendeeId))
        .collect();
      for (const job of jobs) await ctx.db.delete(job._id);
      const deliveries = await ctx.db
        .query("emailDeliveries")
        .withIndex("by_attendee_type", (q) =>
          q.eq("attendeeId", guest.attendeeId),
        )
        .collect();
      for (const delivery of deliveries) await ctx.db.delete(delivery._id);
      await ctx.db.delete(guest._id);
    }
    const feedback = await ctx.db
      .query("eventFeedback")
      .withIndex("by_event", (q) => q.eq("eventId", row.eventId))
      .collect();
    for (const item of feedback) await ctx.db.delete(item._id);
    const leads = await ctx.db
      .query("futureEventLeads")
      .withIndex("by_source_event", (q) => q.eq("sourceEventId", row.eventId))
      .collect();
    for (const lead of leads) await ctx.db.delete(lead._id);
    const featured = await getFeaturedSettings(ctx);
    if (featured?.featuredEventId === row.eventId) {
      const others = (await ctx.db.query("events").collect()).filter(
        (event) => event._id !== row._id && event.status === "published",
      );
      const nextFeatured =
        others.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0]
          ?.eventId || initialEvent.id;
      await ctx.db.patch(featured._id, {
        featuredEventId: nextFeatured,
        updatedAt: new Date().toISOString(),
      });
    }
    await ctx.db.delete(row._id);
    return { deleted: row.eventId };
  },
});

export const setFeaturedEvent = mutation({
  args: { eventId: v.string() },
  handler: async (ctx, { eventId }) => {
    await requireActiveOrganizer(ctx);
    const row = await findEvent(ctx, eventId);
    if (!row) fail("Event not found.", 404);
    const existing = await getFeaturedSettings(ctx);
    const now = new Date().toISOString();
    if (existing)
      await ctx.db.patch(existing._id, {
        featuredEventId: eventId,
        updatedAt: now,
      });
    else
      await ctx.db.insert("siteSettings", {
        key: FEATURED_KEY,
        featuredEventId: eventId,
        updatedAt: now,
      });
    return toDanceEvent(row);
  },
});

export { assertInternal } from "./errors";
