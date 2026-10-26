import afroNov from "../events/afro-nov-2026.json";
import { eventConfigSchema } from "./event-config";
import { initialEvent, type DanceEvent } from "./event";

export const knownEvents: DanceEvent[] = [
  initialEvent,
  eventConfigSchema.parse(afroNov),
];

export function findKnownEvent(idOrSlug: string | undefined) {
  if (!idOrSlug) return undefined;
  return knownEvents.find(
    (event) => event.id === idOrSlug || event.slug === idOrSlug,
  );
}

export function trackingEventForPath(pathname: string) {
  if (pathname === "/") return initialEvent;
  const match = /^\/event\/([^/]+)/.exec(pathname);
  return match ? findKnownEvent(match[1]) : undefined;
}
