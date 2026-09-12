import { connectors } from "@/lib/research/connectors";
import { researchConfig } from "@/lib/research/config";
import { rankPaper } from "@/lib/research/ranking";

export async function POST() {
  if (!researchConfig.liveSync) {
    return Response.json({ mode: "demo", message: "Live sync is disabled. Add API keys and set ENABLE_LIVE_SYNC=true when ready.", papers: [], sources: [] });
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const results = await Promise.all(connectors.map((connector) => connector.fetchRecent(since)));
  const papers = results.flatMap((result) => result.papers).map(rankPaper);
  return Response.json({ mode: "live", papers, sources: results.map(({ source, status, message, papers: sourcePapers }) => ({ source, status, message, count: sourcePapers.length })) });
}
