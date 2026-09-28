import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), mutate: vi.fn() }));
vi.mock("@/lib/admin", () => ({ requireAdmin: mocks.authorize }));
vi.mock("@/lib/auth-server", () => ({ fetchAuthMutation: mocks.mutate }));
import { POST } from "../app/api/admin/attendees/[id]/route";
import { PublicError } from "../lib/http";
import { adminGuest } from "../lib/admin-guest";
import type { Attendee } from "../lib/booking";
beforeEach(() => {
  vi.stubEnv("APP_URL", "https://example.test");
  mocks.authorize.mockReset().mockResolvedValue(undefined);
  mocks.mutate.mockReset().mockResolvedValue("event-1");
});
function request(accept = "application/json", origin = "https://example.test") {
  return new Request("https://example.test/api/admin/attendees/guest-1", {
    method: "POST",
    headers: {
      origin,
      accept,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "action=check_in&view=check-in",
  });
}
const params = Promise.resolve({ id: "guest-1" });
test("inline check-in returns success only after authorized mutation", async () => {
  const response = await POST(request(), { params });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
  expect(mocks.authorize).toHaveBeenCalledWith(true);
  expect(mocks.mutate).toHaveBeenCalledWith(expect.anything(), {
    attendeeId: "guest-1",
    action: "check_in",
  });
});
test("inline undo check-in routes through the same mutation", async () => {
  const response = await POST(
    new Request("https://example.test/api/admin/attendees/guest-1", {
      method: "POST",
      headers: {
        origin: "https://example.test",
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "action=undo_check_in&view=check-in",
    }),
    { params },
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
  expect(mocks.mutate).toHaveBeenCalledWith(expect.anything(), {
    attendeeId: "guest-1",
    action: "undo_check_in",
  });
});
test("standard attendee form keeps redirect behavior", async () => {
  const response = await POST(request("text/html"), { params });
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe(
    "https://example.test/admin/events/event-1/check-in",
  );
});
test("cross-origin actions never mutate", async () => {
  const response = await POST(
    request("application/json", "https://wrong.test"),
    { params },
  );
  expect(response.status).toBe(403);
  expect(mocks.mutate).not.toHaveBeenCalled();
});
test("expired organizer access never mutates", async () => {
  mocks.authorize.mockRejectedValue(
    new PublicError("Sign in to continue.", 401),
  );
  const response = await POST(request(), { params });
  expect(response.status).toBe(401);
  expect(mocks.mutate).not.toHaveBeenCalled();
});
test("conflicting shared updates expose failure instead of false success", async () => {
  mocks.mutate.mockRejectedValue(
    new PublicError("This status change is not available.", 409),
  );
  const response = await POST(request(), { params });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({
    error: "This status change is not available.",
  });
});
test("guest client payload excludes ticket tokens and payment identifiers", () => {
  const row = {
    id: "guest-1",
    email: "guest@example.test",
    confirmation_token: "private",
    feedback_token: "private",
    request_key: "private",
    stripe_session_id: "private",
    checkout_url: "private",
  } as Attendee;
  const result = adminGuest(row);
  expect(result.email).toBe(row.email);
  for (const field of [
    "confirmation_token",
    "feedback_token",
    "request_key",
    "stripe_session_id",
    "checkout_url",
  ])
    expect(result).not.toHaveProperty(field);
});
