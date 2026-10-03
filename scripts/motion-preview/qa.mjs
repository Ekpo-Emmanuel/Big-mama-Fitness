import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext();
const errors = [];
await context.route("**/*", (route) => {
  const url = new URL(route.request().url());
  if (url.hostname !== "127.0.0.1") return route.abort();
  if (url.pathname.startsWith("/api/"))
    return route.fulfill({
      status: 503,
      json: { error: "Fixture network failure" },
    });
  return route.continue();
});
await context.addInitScript(() => {
  window.motionCalls = [];
  const animate = Element.prototype.animate;
  Element.prototype.animate = function (...args) {
    window.motionCalls.push({ tag: this.tagName, duration: args[1]?.duration });
    return animate.apply(this, args);
  };
  window.motionShifts = [];
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries())
      window.motionShifts.push(entry.value);
  }).observe({ type: "layout-shift", buffered: true });
});
const page = await context.newPage();
page.on("pageerror", (e) => {
  errors.push(e.message);
  console.error(e.message);
});
page.setDefaultTimeout(20000);
const base = "http://127.0.0.1:3201";
const go = async (path) => {
  await page.goto(base + path);
  await page.locator("h1").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
};
const noOverflow = async () => {
  const overflow = await page.evaluate(() => ({
    width: innerWidth,
    total: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll("body *")]
      .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
      .slice(0, 8)
      .map((el) => `${el.tagName}.${el.className}`),
  }));
  expect(
    overflow.total,
    `${page.url()} ${JSON.stringify(overflow)}`,
  ).toBeLessThanOrEqual(overflow.width);
};
await fs.mkdir("artifacts/motion", { recursive: true });
const routes = [
  "/motion",
  "/motion/register",
  "/motion/success",
  "/motion/pending",
  "/motion/sold-out",
  "/motion/feedback",
  "/login",
  "/admin",
  "/admin/events/preview",
  ...["guests", "check-in", "feedback", "leads", "details"].map(
    (view) => `/admin/events/preview/${view}`,
  ),
];
let views = 0;
for (const width of process.argv.includes("--flows-only")
  ? []
  : [320, 375, 390, 430, 1440]) {
  await page.setViewportSize({ width, height: 900 });
  for (const route of routes) {
    await go(route);
    await noOverflow();
    views++;
    if (
      width === 390 &&
      ["/motion", "/admin/events/preview/check-in"].includes(route)
    )
      await page.screenshot({
        path: `artifacts/motion/${route.replaceAll("/", "-")}.png`,
        fullPage: true,
      });
  }
  await go("/motion/register");
  const trigger = page.getByRole("button", {
    name: "Participation Waiver and Assumption of Risk",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveJSProperty("open", true);
  await page.waitForTimeout(250);
  const bounds = await dialog.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.width).toBeLessThanOrEqual(width);
  await page.keyboard.press("Tab");
  expect(
    await dialog.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(dialog).toHaveCount(0);
  await trigger.click();
  await page.getByRole("button", { name: "Accept & Continue" }).click();
  await expect(page.locator('[name="waiverAccepted"]')).toBeChecked();
  await expect(trigger).toBeFocused();
  await noOverflow();
  console.log(`Viewport ${width}: pages and waiver passed`);
}

await page.setViewportSize({ width: 390, height: 844 });
await go("/motion/register");
await page.getByRole("button", { name: /Continue to secure checkout/ }).click();
await expect(page.locator('[name="firstName"]')).toBeFocused();
await expect(page.locator('[name="firstName"]')).toHaveAttribute(
  "aria-invalid",
  "true",
);
for (const [name, value] of Object.entries({
  firstName: "Linda",
  lastName: "Test",
  email: "linda@example.test",
  phone: "2505550101",
}))
  await page.locator(`[name="${name}"]`).fill(value);
await page.locator('[name="waiverAccepted"]').check();
let requests = 0;
await page.route("**/api/events/*/checkout", async (route) => {
  requests++;
  await new Promise((resolve) => setTimeout(resolve, 800));
  await route.fulfill({
    status: 503,
    json: { error: "Checkout fixture unavailable" },
  });
});
await page.getByRole("button", { name: /Continue to secure checkout/ }).click();
await expect(
  page.getByRole("button", { name: /Opening secure checkout/ }),
).toBeDisabled();
await expect(page.locator(".motion-loading")).toBeVisible();
await expect(page.getByText("Checkout fixture unavailable")).toBeVisible();
expect(requests).toBe(1);
await page.unroute("**/api/events/*/checkout");
await page.route("**/api/events/*/checkout", (route) =>
  route.fulfill({ json: { url: base + "/motion/checkout" } }),
);
await page.getByRole("button", { name: /Continue to secure checkout/ }).click();
await expect(
  page.getByRole("heading", { name: "Checkout destination fixture" }),
).toBeVisible();

await go("/admin/events/preview/check-in");
const remote = await context.newPage();
remote.on("pageerror", (e) => errors.push(e.message));
await remote.goto(base + "/admin/events/preview/check-in");
await remote.getByText("Live", { exact: true }).waitFor();
const card = page.locator("article").first();
await card.getByRole("button", { name: "Check in", exact: true }).click();
await expect(card.getByRole("button", { name: "Undo check-in" })).toBeVisible();
await expect(
  remote
    .locator("article")
    .first()
    .getByRole("button", { name: "Undo check-in" }),
).toBeVisible();
expect(
  await remote.evaluate(() =>
    window.motionCalls.some((c) => c.tag === "ARTICLE" && c.duration === 120),
  ),
).toBe(true);
await card.getByRole("button", { name: "Undo check-in" }).click();
await expect(
  remote
    .locator("article")
    .first()
    .getByRole("button", { name: "Check in", exact: true }),
).toBeVisible();
await remote.close();
await page.getByRole("button", { name: /^Not checked in/ }).click();
await expect(page.locator("article")).toHaveCount(1);
await page
  .locator("article")
  .getByRole("button", { name: "Check in", exact: true })
  .click();
await expect(page.locator("article")).toHaveCount(0);
await expect(page.getByText("No guests in this view")).toBeVisible();
await page.getByRole("button", { name: /^All / }).click();
await page.getByRole("searchbox").fill("Marisol");
await expect(page.locator("article")).toHaveCount(1);
await expect(page.locator("article")).toContainText("Marisol");

await go("/admin/events/preview/check-in?failure");
await page
  .locator("article")
  .first()
  .getByRole("button", { name: "Check in", exact: true })
  .click();
await expect(page.getByRole("alert")).toContainText("Couldn't check");
await expect(
  page
    .locator("article")
    .first()
    .getByRole("button", { name: "Check in", exact: true }),
).toBeEnabled();

await go("/admin/events/preview/guests");
await page
  .locator("article")
  .first()
  .getByText("Guest details", { exact: true })
  .click();
await page
  .getByRole("button", { name: "Record completed refund" })
  .first()
  .click();
await expect(page.getByRole("dialog")).toBeVisible();
await page.getByRole("button", { name: "Keep registration" }).click();
await expect(page.getByRole("dialog")).toHaveCount(0);
await page.getByText("More", { exact: true }).click();
await page
  .getByRole("navigation", { name: "Mobile event navigation" })
  .getByRole("link", { name: "Feedback", exact: true })
  .click();
await expect(page).toHaveURL(/feedback$/);

for (const route of ["/motion/feedback", "/motion", "/motion/sold-out"]) {
  await go(route);
  let leadBody;
  await page.route("**/api/events/**", async (request) => {
    if (request.request().url().endsWith("/leads"))
      leadBody = request.request().postDataJSON();
    await new Promise((r) => setTimeout(r, 350));
    await request.fulfill({ json: { ok: true } });
  });
  if (route.endsWith("feedback")) {
    await page.getByRole("radio").last().click();
    await page.locator('button[type="submit"]').click();
    await expect(page.getByRole("status")).toContainText(
      "Thanks for the feedback",
    );
  } else {
    for (const [name, value] of Object.entries({
      firstName: "Linda",
      email: "linda@example.test",
    }))
      await page.locator(`[name="${name}"]`).fill(value);
    await page
      .getByRole("button", {
        name: /Notify Me About the Next Class|Join the Next Class List/,
      })
      .click();
    await expect(page.getByRole("status").last()).toContainText(
      "You’re on the list",
    );
    expect(leadBody.sourceContext).toBe(
      route.endsWith("sold-out")
        ? "current_event_sold_out"
        : "cant_make_current_date",
    );
    expect(leadBody).not.toHaveProperty("name");
    expect(leadBody).not.toHaveProperty("waiverAccepted");
    const analyticsLead = await page.evaluate(() =>
      window.dataLayer.findLast(
        (item) => item.event === "future_event_lead_submit",
      ),
    );
    expect(analyticsLead.lead_context).toBe(leadBody.sourceContext);
    expect(analyticsLead).not.toHaveProperty("email");
    expect(analyticsLead).not.toHaveProperty("firstName");
    expect(analyticsLead).not.toHaveProperty("phone");
  }
  await page.unroute("**/api/events/**");
}

await go("/admin/events/preview/guests");
await page.getByRole("button", { name: /^Incomplete / }).click();
await expect(
  page.getByText("These checkouts are incomplete.", { exact: false }),
).toBeVisible();
await expect(page.locator("article").first()).toContainText(
  "Payment incomplete",
);

await go("/motion");
const benefits = page.locator(".bg-sun .grid").first();
await benefits.scrollIntoViewIfNeeded();
await page.waitForTimeout(350);
const reveals = await page.evaluate(() => window.motionCalls.length);
expect(reveals).toBe(1);
await page.locator("h1").scrollIntoViewIfNeeded();
await benefits.scrollIntoViewIfNeeded();
expect(await page.evaluate(() => window.motionCalls.length)).toBe(reveals);
const faq = page.locator("details").first();
await faq.locator("summary").click();
await expect(faq).toHaveJSProperty("open", true);
await faq.locator("summary").click();
await expect(faq).toHaveJSProperty("open", false);

// Replay the real hero CSS with fonts/images already loaded: motion must not reflow.
await page.locator("h1").scrollIntoViewIfNeeded();
await page.evaluate(() => {
  const hero = document.querySelector(".motion-hero");
  hero.style.animation = "none";
  void hero.offsetHeight;
  window.motionShifts = [];
  hero.style.animation = "";
});
await page.waitForTimeout(350);
expect(
  await page.evaluate(() =>
    window.motionShifts.reduce((sum, shift) => sum + shift, 0),
  ),
).toBe(0);

await page.emulateMedia({ reducedMotion: "reduce" });
await go("/motion");
expect(
  await page
    .locator(".motion-hero")
    .evaluate((el) => getComputedStyle(el).animationName),
).toBe("none");
await page.locator(".bg-sun").first().scrollIntoViewIfNeeded();
expect(await page.evaluate(() => window.motionCalls.length)).toBe(0);
await go("/admin/events/preview/check-in");
await page
  .locator("article")
  .first()
  .getByRole("button", { name: "Check in", exact: true })
  .click();
await expect(
  page
    .locator("article")
    .first()
    .getByRole("button", { name: "Undo check-in" }),
).toBeVisible();
expect(await page.evaluate(() => window.motionCalls.length)).toBe(0);
await go("/motion/register");
await page
  .getByRole("button", {
    name: "Participation Waiver and Assumption of Risk",
    exact: true,
  })
  .click();
expect(
  await page
    .getByRole("dialog")
    .evaluate((el) => getComputedStyle(el).transitionDuration),
).toMatch(/^0s/);
await page.keyboard.press("Escape");
await page.emulateMedia({ reducedMotion: "no-preference" });
await go("/motion/register");
const trigger = page.getByRole("button", {
  name: "Participation Waiver and Assumption of Risk",
  exact: true,
});
for (let i = 0; i < 4; i++) {
  await trigger.click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
}
await expect(trigger).toBeFocused();
await expect(page.locator("dialog")).not.toBeVisible();
// Keyboard activation disables transitions without waiting for an entrance.
await trigger.focus();
await page.keyboard.press("Enter");
expect(
  await page
    .getByRole("dialog")
    .evaluate((el) => getComputedStyle(el).transitionDuration),
).toMatch(/^0s/);
await page.keyboard.press("Escape");
expect(errors).toEqual([]);
const result = {
  views,
  widths: [320, 375, 390, 430, 1440],
  browser: "Chromium / Edge",
  errors,
  checks:
    "overflow, hydration, dialogs/focus, validation, slow checkout/retry/redirect, local+simulated remote check-in/undo, filters/search, action failure, mobile nav, saved forms, reduced motion, rapid toggles, keyboard",
};
await fs.writeFile(
  "artifacts/motion/results.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
await browser.close();
