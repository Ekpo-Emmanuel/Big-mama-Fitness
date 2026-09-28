import { readFileSync, writeFileSync } from "node:fs";
import { getEvent, saveEventConfig } from "../lib/db";
const [command, value, output] = process.argv.slice(2);
async function main() {
  if (command === "export" && value && output) {
    const event = await getEvent(value);
    if (!event) throw new Error("Event not found.");
    writeFileSync(output, JSON.stringify(event, null, 2) + "\n", {
      flag: "wx",
    });
    console.log("Event configuration exported.");
  } else if (command === "import" && value) {
    const event = await saveEventConfig(
      JSON.parse(readFileSync(value, "utf8")),
    );
    console.log("Saved event " + event.slug);
  } else
    throw new Error(
      "Usage: event-config.ts export <slug-or-id> <new-file.json> | import <file.json>",
    );
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
