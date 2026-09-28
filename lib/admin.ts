import { redirect } from "next/navigation";
import { fetchAuthQuery, isAuthenticated } from "./auth-server";
import { api } from "./convex";
import { PublicError } from "./http";

export async function requireAdmin(apiRoute = false) {
  if (!(await isAuthenticated())) {
    if (apiRoute) throw new PublicError("Sign in to continue.", 401);
    redirect("/login");
  }
  const organizer = await fetchAuthQuery(api.organizers.currentOrganizer, {});
  if (!organizer) {
    if (apiRoute) throw new PublicError("Organizer access required.", 403);
    redirect("/login");
  }
}
