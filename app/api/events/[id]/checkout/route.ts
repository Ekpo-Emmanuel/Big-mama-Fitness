import { reserve } from "@/lib/booking";
import { createCheckout, stripeClient } from "@/lib/stripe";
import {
  failure,
  readJson,
  sameOrigin,
  rateLimit,
  PublicError,
} from "@/lib/http";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    await rateLimit(request, "checkout");
    if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.APP_URL)
      throw new PublicError(
        "Booking is not open yet. Please check back soon.",
        503,
      );
    const client = stripeClient();
    const row = await reserve((await params).id, await readJson(request));
    const url = await createCheckout(row, client);
    return Response.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}
