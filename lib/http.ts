import { createHash, timingSafeEqual } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { ZodError } from "zod";
import { api } from "../convex/_generated/api";

export class PublicError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function equal(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function siteUrl() {
  const value = process.env.APP_URL || "http://localhost:3000";
  const url = new URL(value);
  if (
    process.env.NODE_ENV === "production" &&
    process.env.APP_URL &&
    url.protocol !== "https:" &&
    url.hostname !== "localhost" &&
    url.hostname !== "127.0.0.1"
  )
    throw new Error("APP_URL must use HTTPS");
  return url.origin;
}
export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== siteUrl())
    throw new PublicError("Request origin is not allowed.", 403);
}
export async function rateLimit(request: Request, scope: string, max = 12) {
  const ip =
    process.env.TRUST_PROXY === "true"
      ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown"
      : "shared";
  const key = createHash("sha256").update(`${scope}:${ip}`).digest("hex");
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new PublicError("Booking is not open yet. Please check back soon.", 503);
  const client = new ConvexHttpClient(url);
  try {
    await client.mutation(api.rateLimit.hit, {
      key,
      max,
      now: Date.now(),
    });
  } catch (error) {
    if (error instanceof ConvexError) {
      const data = error.data as { message?: string; status?: number } | string;
      if (typeof data === "object" && data.status)
        throw new PublicError(data.message || "Too many attempts.", data.status);
    }
    throw error;
  }
}
export async function readText(request: Request, limit = 12000) {
  if (Number(request.headers.get("content-length") || 0) > limit)
    throw new PublicError("Request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) return "";
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new PublicError("Request is too large.", 413);
    }
    parts.push(value);
  }
  return Buffer.concat(parts).toString("utf8");
}
export async function readForm(request: Request) {
  if (
    !request.headers
      .get("content-type")
      ?.includes("application/x-www-form-urlencoded")
  )
    throw new PublicError("Invalid form.", 415);
  return new URLSearchParams(await readText(request));
}
export async function readJson(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new PublicError("Expected JSON.", 415);
  const text = await readText(request);
  try {
    return JSON.parse(text);
  } catch {
    throw new PublicError("Invalid request.");
  }
}
export function failure(error: unknown) {
  if (error instanceof ZodError)
    return Response.json(
      { error: error.issues[0]?.message || "Check your details." },
      { status: 400 },
    );
  if (error instanceof ConvexError) {
    const data = error.data as { message?: string; status?: number } | string;
    if (typeof data === "string")
      return Response.json({ error: data }, { status: 400 });
    return Response.json(
      { error: data.message || "Request failed." },
      { status: data.status || 400 },
    );
  }
  if (error instanceof PublicError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error(
    "Request failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return Response.json(
    { error: "Unable to complete this request. Please try again." },
    { status: 503 },
  );
}
