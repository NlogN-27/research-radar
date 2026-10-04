import { dashboardData } from "@/lib/research/local-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(dashboardData(), { headers: { "Cache-Control": "no-store" } });
}
