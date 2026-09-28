import { requireAdmin } from "@/lib/admin";
import { fetchAuthMutation } from "@/lib/auth-server";
import { api } from "@/lib/convex";
import { sameOrigin, failure, siteUrl, readForm } from "@/lib/http";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    await requireAdmin(true);
    const form = await readForm(request);
    const attendeeId = (await params).id;
    const action = String(form.get("action"));
    const id =
      action === "resend_confirmation"
        ? await fetchAuthMutation(api.jobs.retryConfirmation, { attendeeId })
        : await fetchAuthMutation(api.guests.update, { attendeeId, action });
    if (request.headers.get("accept")?.includes("application/json")) {
      return Response.json({ ok: true });
    }
    return Response.redirect(
      `${siteUrl()}/admin/events/${id}/${form.get("view") === "check-in" ? "check-in" : "guests"}`,
      303,
    );
  } catch (error) {
    return failure(error);
  }
}
