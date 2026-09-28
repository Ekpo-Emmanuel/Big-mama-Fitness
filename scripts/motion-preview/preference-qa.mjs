import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route("**/*", (route) => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  await page.goto("http://127.0.0.1:3201/admin/events/preview/check-in");
  await page.locator("article").first().getByRole("button", { name: "Check in", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("article")?.getAnimations().some((animation) => animation.playState === "running"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => page.evaluate(() => document.querySelector("article").getAnimations().filter((animation) => animation.playState === "running").length)).toBe(0);
  await expect(page.locator("article").first().getByRole("button", { name: "Undo check-in" })).toBeVisible();
  await page.goto("http://127.0.0.1:3201/motion/register");
  await page.getByRole("button", { name: "Participation Waiver and Assumption of Risk", exact: true }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
  await expect(page.locator("dialog")).not.toBeVisible();
  console.log("Dynamic reduced-motion cancellation and scroll restoration passed.");
} finally {
  await browser.close();
}
