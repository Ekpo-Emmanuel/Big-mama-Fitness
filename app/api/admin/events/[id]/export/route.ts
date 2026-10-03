import { requireAdmin } from "@/lib/admin";
import { fetchAuthQuery } from "@/lib/auth-server";
import { csv } from "@/lib/guest-management";
import { failure, PublicError } from "@/lib/http";
import { api } from "@/lib/convex";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin(true);
    const { id } = await params;
    const kind = new URL(request.url).searchParams.get("kind");
    if (!["guests", "leads"].includes(kind || ""))
      throw new PublicError("Invalid export.");
    const columns =
      kind === "guests"
        ? [
            "first_name",
            "last_name",
            "email",
            "phone",
            "payment_status",
            "attendee_status",
            "waiver_version",
            "waiver_accepted_at",
            "marketing_consent",
            "marketing_consent_at",
            "registered_at",
            "checked_in_at",
            "checked_in_by",
            "cancelled_by",
            "updated_by",
            "attribution",
            "referral_source",
          ]
        : [
            "first_name",
            "last_name",
            "email",
            "phone",
            "marketing_consent",
            "marketing_consent_at",
            "attribution",
            "source_contexts",
            "created_at",
          ];
    const rows =
      kind === "guests"
        ? await fetchAuthQuery(api.booking.listGuests, { eventId: id })
        : await fetchAuthQuery(api.leads.list, { eventId: id });
    return new Response(csv(rows as Record<string, unknown>[], columns), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${kind}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
