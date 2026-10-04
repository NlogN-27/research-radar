import { activeConnectors } from "@/lib/research/connectors";
import { researchConfig } from "@/lib/research/config";
import { deduplicatePapers } from "@/lib/research/dedupe";
import { dashboardData, lastSuccessfulSync, recordSync, upsertPapers } from "@/lib/research/local-db";
import { rankPaper } from "@/lib/research/ranking";
import type { SourceSummary } from "@/lib/research/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!researchConfig.liveSync) {
    return Response.json({ error: "Live sync is disabled. Set ENABLE_LIVE_SYNC=true in .env.local." }, { status: 409 });
  }
  const startedAt = new Date().toISOString();
  const previousSync = lastSuccessfulSync();
  const defaultSince = Date.now() - 8 * 24 * 60 * 60 * 1000;
  const since = new Date(previousSync ? new Date(previousSync).getTime() - 24 * 60 * 60 * 1000 : defaultSince);
  const results = await Promise.all(activeConnectors.map((connector) => connector.fetchRecent(since)));
  const sources: SourceSummary[] = results.map((result) => ({
    name: result.source, status: result.status, count: result.papers.length,
    message: result.message ?? (result.status === "ready" ? "Connected" : "Unavailable"),
  }));
  const successful = results.filter((result) => result.status === "ready");
  const ranked = deduplicatePapers(successful.flatMap((result) => result.papers)).map(rankPaper);
  const status = successful.length === results.length ? "success" : successful.length ? "partial" : "error";
  const message = ranked.length ? `Stored ${ranked.length} deduplicated papers.` : successful.length ? "Sources responded, but no new matching papers were returned." : "All source requests failed.";
  if (ranked.length) upsertPapers(ranked);
  recordSync({ startedAt, status, sinceAt: since.toISOString(), sources, message });
  const response = { ...dashboardData(), sync: { status, message, received: ranked.length } };
  return Response.json(response, { status: status === "error" ? 502 : 200, headers: { "Cache-Control": "no-store" } });
}
