import { api, convexClient, withConvex } from "./convex";

export async function resolveFeedback(slug: string, token: string) {
  return withConvex(() =>
    convexClient().query(api.feedback.resolve, { slug, token }),
  );
}

export async function submitFeedback(eventId: string, input: unknown) {
  return withConvex(() =>
    convexClient().mutation(api.feedback.submit, { eventId, input }),
  );
}
