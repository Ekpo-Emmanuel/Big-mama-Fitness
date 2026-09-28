import { submitFeedback } from "@/lib/feedback-server";
import { sameOrigin, rateLimit, readJson, failure } from "@/lib/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    await rateLimit(request, "feedback", 10);
    const result = await submitFeedback(
      (await params).id,
      await readJson(request),
    );
    return Response.json(result);
  } catch (error) {
    return failure(error);
  }
}
