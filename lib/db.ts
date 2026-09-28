import type { DanceEvent } from "./event";
import { api, convexClient, internalSecret, withConvex } from "./convex";
import { eventConfigSchema } from "./event-config";

export async function getEvent(key: string): Promise<DanceEvent | undefined> {
  return withConvex(async () => {
    return (await convexClient().query(api.events.get, { key })) ?? undefined;
  });
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
