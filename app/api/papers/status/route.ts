import { setPaperStatus } from "@/lib/research/local-db";
import type { PaperStatus } from "@/lib/research/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { paperId?: string; status?: PaperStatus } | null;
  if (!body?.paperId || !body.status || !["unseen", "saved", "dismissed"].includes(body.status)) {
    return Response.json({ error: "paperId and a valid status are required." }, { status: 400 });
  }
  try {
    const changed = setPaperStatus(body.paperId, body.status);
    return Response.json({ paperId: body.paperId, status: body.status, changed });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not update paper status." }, { status: 404 });
  }
}
