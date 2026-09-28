import { api, convexClient, withConvex } from "./convex";

export async function saveLead(eventId: string, input: unknown) {
  return withConvex(() =>
    convexClient().mutation(api.leads.save, { eventId, input }),
  );
}
