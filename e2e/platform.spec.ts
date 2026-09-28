import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440]) {
  test("landing fits " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/event/afro-dance-fitness");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    const cta = page
      .getByRole("link", { name: "Reserve My Spot — $10" })
      .first();
    await expect(cta).toBeVisible();
    expect((await cta.boundingBox())!.y).toBeLessThan(850);
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: "artifacts/landing-" + width + ".png",
        fullPage: true,
      });
    expect(errors).toEqual([]);
  });
}
test("keyboard and automated accessibility audit", async ({ page }) => {
  await page.goto("/event/afro-dance-fitness");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
});
test("UTM survives root redirect and registration; checkout payload has separate consent", async ({
  page,
}) => {
  await page.goto(
    "/?utm_source=poster&utm_medium=qr&utm_campaign=october17&utm_content=gym_lobby",
  );
  await page
    .getByRole("link", { name: "Reserve My Spot — $10" })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "First name", exact: true })
    .fill("Private");
  await page
    .getByRole("textbox", { name: "Last name", exact: true })
    .fill("Guest");
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("private@example.com");
  await page
    .getByRole("textbox", { name: "Phone", exact: true })
    .fill("2505550123");
  await page.getByRole("checkbox", { name: /I have read/ }).check();
  let payload: Record<string, unknown> = {};
  await page.route("**/api/events/*/checkout", async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ url: "/event/afro-dance-fitness/success" }),
    });
  });
  await page
    .getByRole("button", { name: "Continue to secure checkout" })
    .click();
  await expect(page).toHaveURL(/success/);
  expect(payload.marketingConsent).toBe(false);
  expect(payload.waiverAccepted).toBe(true);
  expect(payload.attribution).toMatchObject({
    utm_source: "poster",
    utm_medium: "qr",
    utm_campaign: "october17",
    utm_content: "gym_lobby",
  });
  await expect(
    page.getByRole("heading", { name: "Let’s check your booking." }),
  ).toBeVisible();
  await page.waitForFunction(() => Array.isArray(window.dataLayer));
  const analytics = await page.evaluate(() => JSON.stringify(window.dataLayer));
  expect(analytics).not.toContain("private@example.com");
  expect(analytics).not.toContain("2505550123");
  expect(analytics).not.toContain('"event":"purchase"');
});
test("waiver modal does not accept on close; Accept & Continue checks the form", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/event/afro-dance-fitness/register");
  const formBox = page.getByRole("checkbox", {
    name: /I have read and agree to the Participation Waiver and Assumption of Risk/,
  });
  await page
    .getByRole("button", {
      name: "Participation Waiver and Assumption of Risk",
    })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Participation Waiver and Assumption of Risk",
  });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(formBox).not.toBeChecked();
  await expect(
    page.getByRole("button", {
      name: "Participation Waiver and Assumption of Risk",
    }),
  ).toBeFocused();
  await page
    .getByRole("button", {
      name: "Participation Waiver and Assumption of Risk",
    })
    .click();
  await dialog.getByRole("button", { name: "Accept & Continue" }).click();
  await expect(dialog).toBeHidden();
  await expect(formBox).toBeChecked();
  await formBox.uncheck();
  await expect(formBox).not.toBeChecked();
  await formBox.check();
  await expect(formBox).toBeChecked();
});
test("sold-out lead submission works; cancelled/completed pages have no paid CTA", async ({
  page,
}) => {
  await page.goto(
    "/event/e2e-sold?utm_source=instagram&utm_medium=social&utm_campaign=october17",
  );
  await expect(
    page.getByRole("link", { name: "Reserve My Spot — $10" }),
  ).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "First name", exact: true })
    .fill("Future");
  await page
    .getByRole("textbox", { name: "Last name", exact: true })
    .fill("Guest");
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("future@example.com");
  await page
    .getByRole("textbox", { name: "Phone", exact: true })
    .fill("2505550123");
  await page
    .getByRole("button", { name: "Notify Me About the Next Class" })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Your interest has been saved" }),
  ).toBeVisible();
  for (const state of ["cancelled", "completed"]) {
    await page.goto("/event/e2e-" + state);
    await expect(
      page.getByRole("link", { name: "Reserve My Spot — $10" }),
    ).toHaveCount(0);
  }
});
test("admin auth, export, and one-tap check-in", async ({ page, request }) => {
  expect(
    (
      await request.get("/api/admin/events/e2e-admin/export?kind=guests")
    ).status(),
  ).toBe(401);
  await page.goto("/admin");
  await expect(page).toHaveURL(/login/);
  await page.getByLabel("Email").fill("organizer@example.com");
  await page.getByLabel("Password").fill("test-only-password-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/events/e2e-admin/check-in");
  await page.getByRole("button", { name: "Check in", exact: true }).click();
  await expect(page.getByText("checked in · Payment: paid")).toBeVisible();
  const response = await page.request.get(
    "/api/admin/events/e2e-admin/export?kind=guests",
  );
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("checked_in");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/login/);
});
test("endpoint protections and SEO", async ({ request }) => {
  expect(
    (
      await request.post("/api/events/afro-oct-2026/checkout", {
        data: {},
        headers: { origin: "https://wrong.example" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (await request.post("/api/webhooks/stripe", { data: {} })).status(),
  ).toBe(400);
  const response = await request.get("/event/afro-dance-fitness");
  const html = await response.text();
  expect(html).toContain("application/ld+json");
  expect(html).toContain('rel="canonical"');
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect((await request.get("/sitemap.xml")).status()).toBe(200);
  expect((await request.get("/robots.txt")).status()).toBe(200);
  const image = await request.get("/event/afro-dance-fitness/opengraph-image");
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
});
