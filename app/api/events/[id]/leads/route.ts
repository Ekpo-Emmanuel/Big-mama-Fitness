import { saveLead } from "@/lib/leads";
import { sameOrigin, rateLimit, readJson, failure } from "@/lib/http";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    await rateLimit(request, "leads", 8);
    await saveLead((await params).id, await readJson(request));
    return Response.json({ saved: true });
  } catch (error) {
    return failure(error);
  }
}
