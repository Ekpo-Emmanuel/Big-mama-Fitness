import type { DanceEvent } from "./event";
import { api, convexClient, internalSecret, withConvex } from "./convex";
import { eventConfigSchema } from "./event-config";
import { initialEvent } from "./event";

export async function getEvent(key: string): Promise<DanceEvent | undefined> {
  return withConvex(async () => {
    return (await convexClient().query(api.events.get, { key })) ?? undefined;
  });
}

export async function getFeaturedEvent(): Promise<DanceEvent> {
  try {
    const featured = await withConvex(async () => {
      return convexClient().query(api.events.featured, {});
    });
    if (featured) return featured;
  } catch {
    // Convex may still be pushing events:featured during local `convex dev`.
  }
  return (
    (await getEvent(initialEvent.id)) ??
    (await getEvent(initialEvent.slug)) ??
    initialEvent
  );
}

export async function inventory(id: string) {
  return withConvex(async () => {
    return convexClient().query(api.events.inventory, { eventId: id });
  });
}

export async function listEvents() {
  return withConvex(async () => {
    return convexClient().query(api.events.listAll, {});
  });
}

export async function saveEventConfig(input: unknown) {
  const event = eventConfigSchema.parse(input);
  return withConvex(() =>
    convexClient().mutation(api.events.saveConfig, {
      inputJson: JSON.stringify(event),
      internalSecret: internalSecret(),
    }),
  );
}
