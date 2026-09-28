import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch({channel:"msedge",headless:true});
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(60000);
page.setDefaultNavigationTimeout(120000);
for (const width of [320,375,390,430,768,1024,1440]) {
  await page.setViewportSize({width,height:740});
  await page.goto("http://127.0.0.1:3199/admin/events/preview/guests");
  await page.getByText("Guest details",{exact:true}).first().click();
  await page.getByRole("button",{name:"Record completed refund"}).first().click();
  const dialog=page.getByRole("dialog");
  await dialog.waitFor();
  const bounds=await dialog.boundingBox();
  if(!bounds || bounds.x<0 || bounds.x+bounds.width>width || bounds.y<0 || bounds.y+bounds.height>740) throw new Error(`Dialog outside viewport at ${width}`);
  await page.keyboard.press("Escape");
  if(await page.evaluate(()=>document.activeElement?.textContent)!=="Record completed refund") throw new Error("Dialog focus did not return");
  if(width<768) {
    await page.getByText("More",{exact:true}).click();
    await page.getByRole("link",{name:"Feedback",exact:true}).click();
    await page.getByRole("heading",{name:"Guest feedback",exact:true}).waitFor();
    if(await page.getByRole("link",{name:"Future-event leads",exact:true}).isVisible()) throw new Error("More menu did not close after navigation");
  }
}
await page.setViewportSize({width:390,height:900});
await page.goto("http://127.0.0.1:3199/admin/events/preview/guests");
await page.getByRole("heading",{name:"Guests",exact:true}).waitFor();
await page.screenshot({path:"artifacts/admin/final-guests-390.png",fullPage:true});
await page.goto("http://127.0.0.1:3199/admin/events/preview/check-in");
await page.getByRole("heading",{name:"Check-in",exact:true}).waitFor();
await page.screenshot({path:"artifacts/admin/final-check-in-390.png",fullPage:true});
await page.setViewportSize({width:1440,height:1000});
await page.goto("http://127.0.0.1:3199/admin/events/preview");
await page.getByRole("heading",{name:"Event overview",exact:true}).waitFor();
await page.screenshot({path:"artifacts/admin/final-overview-1440.png",fullPage:true});
const results=JSON.parse(await fs.readFile("artifacts/admin/qa-results.json","utf8"));
results.dialogWidths=[320,375,390,430,768,1024,1440];
results.keyboardFocusReturn=true;
results.mobileMoreNavigation=true;
await fs.writeFile("artifacts/admin/qa-results.json",JSON.stringify(results,null,2));
console.log("PASS: dialogs fit all seven widths, Escape restores focus, mobile More navigation works.");
await browser.close();
