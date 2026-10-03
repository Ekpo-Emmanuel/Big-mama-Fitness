import { z } from "zod";
export const attributionSchema = z.object({
  client_id: z
    .string()
    .regex(/^\d{1,12}\.\d{1,12}$/)
    .optional(),
  session_id: z.number().int().positive().optional(),
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(100).optional(),
  utm_content: z.string().max(100).optional(),
});
const contact = {
  firstName: z
    .string()
    .trim()
    .min(1, "Enter your first name.")
    .max(80, "First name must be 80 characters or fewer."),
  lastName: z
    .string()
    .trim()
    .min(1, "Enter your last name.")
    .max(80, "Last name must be 80 characters or fewer."),
  email: z
    .email("Enter a valid email address.")
    .trim()
    .toLowerCase()
    .max(254, "Email must be 254 characters or fewer."),
  phone: z
    .string()
    .trim()
    .min(1, "Enter your phone number.")
    .regex(
      /^\+?[\d\s().-]{7,25}$/,
      "Enter a valid phone number (digits, spaces, and + ( ) - . allowed).",
    ),
  marketingConsent: z.boolean(),
  attribution: attributionSchema.default({}),
};
export const registrationSchema = z.object({
  ...contact,
  waiverAccepted: z.literal(true, {
    error: "Accept the participation waiver to continue.",
  }),
  waiverVersion: z.string().min(1).max(100),
  referralSource: z.string().trim().max(120).default(""),
  requestKey: z.uuid(),
  /** Fingerprint of purchase-relevant fields shown on the form page. */
  purchaseFingerprint: z.string().min(1).max(500).optional(),
});

/** Client-side fields checked before checkout starts. */
export const registrationFormSchema = registrationSchema.pick({
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  referralSource: true,
  waiverAccepted: true,
  marketingConsent: true,
});

export const leadContextSchema = z.enum([
  "cant_make_current_date",
  "current_event_sold_out",
  "registration_closed",
]);
export type LeadContext = z.infer<typeof leadContextSchema>;

export const leadSchema = z.object({
  firstName: contact.firstName,
  lastName: z.string().trim().max(80).default(""),
  email: contact.email,
  phone: z
    .string()
    .trim()
    .max(25)
    .refine(
      (value) => !value || /^\+?[\d\s().-]{7,25}$/.test(value),
      "Enter a valid phone number (digits, spaces, and + ( ) - . allowed).",
    )
    .default(""),
  marketingConsent: contact.marketingConsent,
  attribution: attributionSchema.default({}),
  sourceContext: leadContextSchema.default("registration_closed"),
});

export const feedbackSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, "This feedback link is not valid."),
  rating: z.number().int().min(1).max(5),
  sentiment: z
    .enum(["loved", "good", "okay", "not_for_me"])
    .nullable()
    .optional()
    .default(null),
  enjoyedMost: z.string().trim().max(500).default(""),
  improvement: z.string().trim().max(500).default(""),
});

export type Registration = z.infer<typeof registrationSchema>;
export type FeedbackInput = z.infer<typeof feedbackSchema>;
