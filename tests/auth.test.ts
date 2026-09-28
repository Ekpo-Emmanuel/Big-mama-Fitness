import { test } from "node:test";
import assert from "node:assert/strict";
import { csv } from "../lib/guest-management";
test("CSV escapes quotes, newlines, and spreadsheet formulas", () => {
  const text = csv(
    [{ name: '=HYPERLINK("x")', phone: "+12505550123" }],
    ["name", "phone"],
  );
  assert.ok(text.includes("'=HYPERLINK"));
  assert.ok(text.includes("'+12505550123"));
  assert.ok(text.includes('""x""'));
});
