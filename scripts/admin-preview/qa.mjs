import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultNavigationTimeout(120000);
page.setDefaultTimeout(60000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.route("**/*", (route) =>
  new URL(route.request().url()).hostname === "127.0.0.1"
    ? route.continue()
    : route.abort(),
);
await fs.mkdir("artifacts/admin", { recursive: true });
const routes = [
  "/admin",
  "/admin/events/preview",
  ...["guests", "check-in", "feedback", "leads", "details"].map(
    (view) => `/admin/events/preview/${view}`,
  ),
  "/login",
  "/admin/loading",
  "/admin/error",
];
let checked = 0;
for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
  await page.setViewportSize({ width, height: 900 });
  for (const route of routes) {
    await page.goto(`http://127.0.0.1:3199${route}`);
    await page.locator("header, h1, [role=status]").first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    if (overflow) throw new Error(`Overflow: ${route} at ${width}`);
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: `artifacts/admin/${route.replaceAll("/", "-")}-${width}.png`,
        fullPage: true,
      });
    checked++;
  }
}
await page.setViewportSize({ width: 390, height: 900 });
await page.goto("http://127.0.0.1:3199/admin/events/preview/check-in");
await page
  .getByLabel("Search guests by name, email or phone")
  .fill("Alexandria");
await page.getByRole("button", { name: "Check in", exact: true }).click();
await page.getByRole("status").filter({ hasText: "checked in" }).waitFor();
if (
  (await page
    .getByLabel("Search guests by name, email or phone")
    .inputValue()) !== "Alexandria"
)
  throw new Error("Search lost after check-in");
await page.getByRole("button", { name: "Clear search" }).click();
await page.getByRole("button", { name: "Not checked in", exact: true }).click();
await page.getByText("No guests in this view").waitFor();
await page.goto("http://127.0.0.1:3199/admin/events/preview/guests");
await page.getByRole("button", { name: /Incomplete/ }).click();
await page.getByText("No ticket is confirmed", { exact: false }).waitFor();
await page.getByText("Amara Mensah", { exact: true }).waitFor();
await page.getByRole("button", { name: /Guests \(/ }).click();
await page.getByText("Guest details", { exact: true }).first().click();
await page
  .getByRole("button", { name: "Record completed refund" })
  .first()
  .click();
await page.getByRole("dialog").waitFor();
if (
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
)
  throw new Error("Dialog overflow");
await page.screenshot({ path: "artifacts/admin/refund-dialog-390.png" });
await page.keyboard.press("Escape");
await page
  .getByRole("button", { name: "Record completed refund" })
  .first()
  .waitFor({ state: "visible" });
const axe = await new AxeBuilder({ page }).analyze();
const severe = axe.violations.filter((v) =>
  ["serious", "critical"].includes(v.impact),
);
if (severe.length)
  throw new Error(
    JSON.stringify(
      severe.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ),
  );
await page.goto(
  "http://127.0.0.1:3199/admin/events/preview/check-in?failure=1",
);
await page.getByRole("button", { name: "Check in", exact: true }).click();
await page
  .getByRole("alert")
  .filter({ hasText: "Connection interrupted" })
  .waitFor();
await page
  .getByRole("button", { name: "Check in", exact: true })
  .waitFor({ state: "visible" });
for (const route of [
  "/admin",
  ...["guests", "check-in", "feedback", "leads"].map(
    (view) => `/admin/events/preview/${view}`,
  ),
]) {
  await page.goto(`http://127.0.0.1:3199${route}?empty=1`);
  await page.getByRole("heading", { level: 1 }).waitFor();
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw new Error("Empty state overflow");
}
if (errors.length) throw new Error(errors.join("\n"));
await fs.writeFile(
  "artifacts/admin/qa-results.json",
  JSON.stringify(
    {
      responsivePages: checked,
      widths: [320, 375, 390, 430, 768, 1024, 1440],
      interactions:
        "check-in, retained search, filters, incomplete separation, refund dialog, Escape, failure recovery, empty states",
      seriousAccessibilityViolations: severe.length,
    },
    null,
    2,
  ),
);
console.log(
  `PASS: ${checked} responsive page checks; guest interactions, errors, empty states, and accessibility.`,
);
await browser.close();
