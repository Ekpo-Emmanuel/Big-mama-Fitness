import { test, beforeEach } from "vitest";
import assert from "node:assert/strict";
import {
  adoptCheckoutRequestKey,
  checkoutRequestKey,
  checkoutStorageKey,
  clearActiveRegistration,
  REQUEST_KEY_QUERY,
} from "../lib/checkout-attempt";

const eventId = "afro-oct-2026";
const keyA = "11111111-1111-4111-8111-111111111111";
const keyB = "22222222-2222-4222-8222-222222222222";

const memory = new Map<string, string>();
let cookieJar = "";

beforeEach(() => {
  memory.clear();
  cookieJar = "";
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => {
        memory.set(k, v);
      },
      removeItem: (k: string) => {
        memory.delete(k);
      },
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      get cookie() {
        return cookieJar;
      },
      set cookie(value: string) {
        const [pair] = value.split(";");
        const eq = pair.indexOf("=");
        const name = pair.slice(0, eq);
        const raw = pair.slice(eq + 1);
        if (value.includes("Max-Age=0")) {
          cookieJar = cookieJar
            .split("; ")
            .filter((part) => part && !part.startsWith(name + "="))
            .join("; ");
          return;
        }
        const next = name + "=" + raw;
        const rest = cookieJar
          .split("; ")
          .filter((part) => part && !part.startsWith(name + "="));
        rest.push(next);
        cookieJar = rest.join("; ");
      },
    },
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { protocol: "https:" },
  });
  clearActiveRegistration(eventId);
});

test("checkoutRequestKey reuses sessionStorage across calls", () => {
  const first = checkoutRequestKey(eventId);
  const second = checkoutRequestKey(eventId);
  assert.equal(first, second);
  assert.equal(memory.get(checkoutStorageKey(eventId)), first);
});

test("adoptCheckoutRequestKey restores after sessionStorage wipe (Stripe return)", () => {
  adoptCheckoutRequestKey(eventId, keyA);
  assert.equal(checkoutRequestKey(eventId), keyA);
  memory.clear();
  // Cookie still holds keyA — cancel/retry recovery without sessionStorage.
  assert.equal(checkoutRequestKey(eventId), keyA);
});

test("URL rk param name is rk for cancel_url round-trip", () => {
  assert.equal(REQUEST_KEY_QUERY, "rk");
  adoptCheckoutRequestKey(eventId, keyB);
  assert.equal(checkoutRequestKey(eventId), keyB);
});

test("clearActiveRegistration drops storage and cookie so next key is new", () => {
  const first = checkoutRequestKey(eventId);
  clearActiveRegistration(eventId);
  memory.clear();
  cookieJar = "";
  const second = checkoutRequestKey(eventId);
  assert.notEqual(first, second);
});

test("invalid rk is ignored", () => {
  assert.equal(adoptCheckoutRequestKey(eventId, "not-a-uuid"), false);
});
