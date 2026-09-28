import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { api } from "../convex/_generated/api";
import { PublicError } from "./http";

// TODO: After the app is stable, stage a rename to INTERNAL_API_SECRET.
// CRON_SECRET is the shared Next.js-to-Convex secret, not a cron secret.
// Server-only. Never use a NEXT_PUBLIC_ prefix. Same value on Next.js and Convex. Minimum 32 characters.
export function internalSecret() {
  const value = process.env.CRON_SECRET;
  if (!value || value.length < 32)
    throw new PublicError("Booking is not open yet. Please check back soon.", 503);
  return value;
}

export function convexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url)
    throw new PublicError("Booking is not open yet. Please check back soon.", 503);
  return new ConvexHttpClient(url);
}

export function convexError(error: unknown) {
  if (error instanceof ConvexError) {
    const data = error.data as { message?: string; status?: number } | string;
    if (typeof data === "string") throw new PublicError(data, 400);
    throw new PublicError(data.message || "Request failed.", data.status || 400);
  }
  throw error;
}

export async function withConvex<T>(action: () => Promise<T>) {
  try {
    return await action();
  } catch (error) {
    convexError(error);
    throw error;
  }
}

export { api };
