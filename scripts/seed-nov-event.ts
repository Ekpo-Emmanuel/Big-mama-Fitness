/**
 * Keep the October event intact and insert/update November 21, 2026.
 * Sets November as the homepage featured event.
 *
 *   npm run event:nov
 */
import { getEvent, saveEventConfig } from "../lib/db";
import { initialEvent, octoberEvent } from "../lib/event";

async function main() {
  const oct =
    (await getEvent(octoberEvent.id)) ?? (await getEvent("afro-oct-2026"));
  if (oct && oct.id === octoberEvent.id) {
    await saveEventConfig({
      ...oct,
      ...octoberEvent,
      waiverText: oct.waiverText || octoberEvent.waiverText,
      waiverVersion: oct.waiverVersion || octoberEvent.waiverVersion,
      slug: octoberEvent.slug,
      status: "completed",
      registrationOpen: false,
      isPublished: true,
      capacity: oct.capacity || octoberEvent.capacity,
    });
    console.log(`Kept ${octoberEvent.id} as ${octoberEvent.slug} (completed).`);
  } else if (!oct) {
    await saveEventConfig(octoberEvent);
    console.log(`Inserted historical ${octoberEvent.id}.`);
  }

  const saved = await saveEventConfig(initialEvent);
  console.log(
    `Saved ${saved.id} → /event/${saved.slug} (${saved.startsAt} → ${saved.endsAt}). Homepage featured.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
