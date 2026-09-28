import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const url = readFileSync(process.env.TEMP + "/bmm-checkout-url.txt", "utf8").trim();
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage();
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
const agent = page.getByRole("checkbox", { name: /AI agent/i });
if (await agent.count()) await agent.check({ force: true }).catch(() => {});
await page
  .frameLocator('iframe[title="Secure card number input frame"]')
  .locator("input[name=cardnumber]")
  .fill("4242424242424242");
await page
  .frameLocator('iframe[title="Secure expiration date input frame"]')
  .locator("input[name=exp-date]")
  .fill("1234");
await page
  .frameLocator('iframe[title="Secure CVC input frame"]')
  .locator("input[name=cvc]")
  .fill("123");
const postal = page.locator("input[name=postalCode], input[name=postal]");
if (await postal.count()) await postal.first().fill("V9S5X9");
await page.getByRole("button", { name: "Book" }).click();
await page.waitForURL(/localhost:3000|checkout\.stripe\.com/, { timeout: 60000 });
console.log(JSON.stringify({ landed: new URL(page.url()).origin + new URL(page.url()).pathname }));
await browser.close();
