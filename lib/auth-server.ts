import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
import type { FunctionReference } from "convex/server";

function auth() {
  return convexBetterAuthNextJs({
    convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL || "http://127.0.0.1:3210",
    convexSiteUrl:
      process.env.NEXT_PUBLIC_CONVEX_SITE_URL || "http://127.0.0.1:3211",
  });
}

export const handler = {
  GET: (request: Request) => auth().handler.GET(request),
  POST: (request: Request) => auth().handler.POST(request),
};

export const isAuthenticated = () => auth().isAuthenticated();
export const getToken = () => auth().getToken();
export function fetchAuthQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: Query["_args"],
) {
  return auth().fetchAuthQuery(query as never, args as never);
}
export function fetchAuthMutation<Mutation extends FunctionReference<"mutation">>(
  mutation: Mutation,
  args: Mutation["_args"],
) {
  return auth().fetchAuthMutation(mutation as never, args as never);
}
