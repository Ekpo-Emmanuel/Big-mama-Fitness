import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const event = await client.query(api.events.get, { key: "afro-oct-2026" });
const inventory = event
  ? await client.query(api.events.inventory, { eventId: event.id })
  : null;
console.log(
  JSON.stringify({
    id: event?.id,
    name: event?.name,
    priceCents: event?.priceCents,
    currency: event?.currency,
    waiverVersion: event?.waiverVersion || "",
    waiverLen: event?.waiverText?.length ?? 0,
    hero: Boolean(event?.heroImageUrl),
    sold: inventory?.sold,
    held: inventory?.held,
  }),
);
