import { z } from "zod";
const text = z.string().trim().max(2000);
const media = z
  .string()
  .regex(/^$|^\/(?!\/)[a-zA-Z0-9/_. -]+$/, "Use a local /media/ path.");
const instant = z.iso.datetime({ offset: true });
export const eventConfigSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,80}$/),
    slug: z.string().regex(/^[a-z0-9-]{1,80}$/),
    name: text.min(1).max(160),
    shortName: text.min(1).max(80),
    headline: text.min(1).max(160),
    subheadline: text.min(1),
    description: text,
    startsAt: instant,
    endsAt: instant,
    workoutStartsAt: instant,
    workoutEndsAt: instant,
    timezone: z.string().refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "Use a valid timezone."),
    venueName: text,
    addressLine1: text.min(1),
    city: text.min(1),
    province: text.min(1),
    postalCode: text.min(1),
    country: z.string().length(2),
    priceCents: z.number().int().min(1).max(100000),
    currency: z.literal("CAD"),
    capacity: z.number().int().min(1).max(20),
    targetAttendance: z.number().int().min(0).max(20),
    status: z.enum([
      "draft",
      "published",
      "sold_out",
      "completed",
      "cancelled",
    ]),
    isPublished: z.boolean(),
    registrationOpen: z.boolean(),
    instructorName: text.min(1),
    instructorBio: text,
    contactEmail: z.union([z.email(), z.literal("")]),
    heroImageUrl: media,
    heroVideoUrl: media,
    instructorImageUrl: media,
    waiverVersion: z.string().max(100),
    waiverText: z.string().max(50000),
  })
  .superRefine((e, ctx) => {
    const times = [
      e.startsAt,
      e.workoutStartsAt,
      e.workoutEndsAt,
      e.endsAt,
    ].map(Date.parse);
    if (times.some((t, i) => i > 0 && t <= times[i - 1]))
      ctx.addIssue({
        code: "custom",
        message: "Schedule must be in chronological order.",
      });
    if (e.targetAttendance > e.capacity)
      ctx.addIssue({
        code: "custom",
        message: "Internal attendance target cannot exceed capacity.",
      });
    if (Boolean(e.waiverText) !== Boolean(e.waiverVersion))
      ctx.addIssue({
        code: "custom",
        message: "Provide both waiver text and version.",
      });
  });
