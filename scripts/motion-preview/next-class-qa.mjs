import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );
  await fs.mkdir("artifacts/next-class-ux", { recursive: true });
  let views = 0;
  for (const width of [320, 375, 390, 430, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const state of ["open", "sold-out", "closed"]) {
      await page.goto(`http://127.0.0.1:3201/motion/${state}`);
      const section = page.locator("#next-class");
      await section.waitFor();
      await page.evaluate(() => document.fonts.ready);
      await expect(section).toHaveCount(1);
      const position = await page.evaluate(() => ({
        list: document.querySelector("#next-class").getBoundingClientRect().top,
        hero: document.querySelector("h1").getBoundingClientRect().top,
      }));
      expect(
        state === "open"
          ? position.list > position.hero
          : position.list < position.hero,
      ).toBe(true);
      await section.scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(section.locator('input:not([type="checkbox"])')).toHaveCount(
        2,
      );
      if ([390, 1440].includes(width))
        await section.screenshot({
          path: `artifacts/next-class-ux/${state}-${width}.png`,
        });
      views++;
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const state of ["open", "sold-out", "closed"]) {
    for (const consent of [false, true]) {
      await page.goto(`http://127.0.0.1:3201/motion/${state}`);
      const form = page.locator("#next-class form");
      await form.getByRole("button").click();
      await expect(form.locator('[name="firstName"]')).toBeFocused();
      await form.getByLabel("First name", { exact: true }).fill("Linda");
      await form.getByLabel("Email", { exact: true }).fill("not-an-email");
      await form.getByRole("button").click();
      expect(
        await form
          .locator('[name="email"]')
          .evaluate((el) => el.validity.valid),
      ).toBe(false);
      await form
        .getByLabel("Email", { exact: true })
        .fill("linda@example.test");
      if (consent) await form.getByRole("checkbox").check();
      let payload;
      await page.route("**/api/events/*/leads", async (route) => {
        payload = route.request().postDataJSON();
        await new Promise((resolve) => setTimeout(resolve, 400));
        await route.fulfill({
          status: 503,
          json: { error: "Please try again." },
        });
      });
      await form.getByRole("button").click();
      await expect(form.getByRole("button")).toBeDisabled();
      await expect(form.getByRole("alert")).toContainText("Please try again.");
      await expect(form.getByLabel("Email", { exact: true })).toHaveValue(
        "linda@example.test",
      );
      await page.unroute("**/api/events/*/leads");
      // Same successful response for a new or duplicate lead; backend behavior stays unchanged.
      await page.route("**/api/events/*/leads", (route) =>
        route.fulfill({ json: { saved: true } }),
      );
      await form.getByRole("button").click();
      const success = page.locator("#next-class [role=status]");
      await expect(success).toContainText("You’re on the list.");
      await expect(success).toContainText(
        consent ? "We’ll email you" : "Your interest is saved",
      );
      expect(payload.sourceContext).toBe(
        state === "open"
          ? "cant_make_current_date"
          : state === "sold-out"
            ? "current_event_sold_out"
            : "registration_closed",
      );
      expect(payload.marketingConsent).toBe(consent);
      if (state === "open" && consent)
        await success.screenshot({
          path: "artifacts/next-class-ux/success.png",
        });
      await page.unroute("**/api/events/*/leads");
    }
  }
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("http://127.0.0.1:3201/motion/closed");
  expect(
    await page.evaluate(() => getComputedStyle(document.body).colorScheme),
  ).toContain("light");
  const button = page.locator("#next-class button");
  expect(
    await button.evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toMatch(/^0s/);
  await page.locator('#next-class input[name="firstName"]').focus();
  await page.keyboard.press("Tab");
  await expect(page.locator('#next-class input[name="email"]')).toBeFocused();
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify({
      views,
      states: ["open", "sold-out", "closed"],
      errors,
      passed:
        "validation, slow request, retry, success with/without consent, payload context, dark OS, reduced motion, keyboard",
    }),
  );
} finally {
  await browser.close();
}
