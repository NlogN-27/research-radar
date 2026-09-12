import { connectorStatuses, researchConfig } from "@/lib/research/config";

export async function GET() {
  return Response.json({ liveSync: researchConfig.liveSync, sources: connectorStatuses() });
}
