import { connectorStatuses, researchConfig } from "@/lib/research/config";
import { latestSourceSummaries } from "@/lib/research/local-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ liveSync: researchConfig.liveSync, configured: connectorStatuses(), latest: latestSourceSummaries() }, { headers: { "Cache-Control": "no-store" } });
}
