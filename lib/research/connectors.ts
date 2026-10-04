import { researchConfig } from "./config";
import type { ConnectorResult, NormalizedPaper, ResearchConnector } from "./types";

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function stableId(prefix: string, value: string) { return `${prefix}:${value.toLowerCase().replace(/[^a-z0-9.-]+/g, "-")}`; }
function missingKey(source: string, variable: string): ConnectorResult {
  return { source, papers: [], status: "missing-key", message: `Add ${variable} to .env.local.` };
}

async function request(url: string, headers?: HeadersInit) {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "ResearchRadar/0.2 (local research reader)", ...headers },
        signal: AbortSignal.timeout(25_000), cache: "no-store",
      });
      if (response.ok) return response;
      if (response.status !== 429 && response.status < 500) throw new Error(`${response.status} ${response.statusText}`);
      lastError = new Error(`${response.status} ${response.statusText}`);
      const retryAfter = Number(response.headers.get("retry-after") ?? 0);
      await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 750 * (2 ** attempt))));
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Request failed");
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 750 * (2 ** attempt)));
    }
  }
  throw lastError ?? new Error("Request failed");
}

function rebuildAbstract(index: unknown) {
  if (!index || typeof index !== "object") return "";
  const words: Array<[number, string]> = [];
  for (const [word, positions] of Object.entries(index as Record<string, unknown>)) {
    if (Array.isArray(positions)) for (const position of positions) if (typeof position === "number") words.push([position, word]);
  }
  return words.sort((a, b) => a[0] - b[0]).map((item) => item[1]).join(" ");
}

export const openAlexConnector: ResearchConnector = {
  name: "OpenAlex",
  async fetchRecent(since) {
    if (!researchConfig.openAlexKey) return missingKey(this.name, "OPENALEX_API_KEY");
    const url = new URL("https://api.openalex.org/works");
    url.searchParams.set("filter", `from_publication_date:${since.toISOString().slice(0, 10)},is_retracted:false`);
    url.searchParams.set("search", "large language model scientific reasoning multimodal agent");
    url.searchParams.set("sort", "publication_date:desc");
    url.searchParams.set("per_page", String(researchConfig.maxPapersPerSource));
    url.searchParams.set("select", "id,doi,title,publication_date,primary_location,authorships,abstract_inverted_index,primary_topic,topics,cited_by_count");
    url.searchParams.set("api_key", researchConfig.openAlexKey);
    try {
      const response = await request(url.toString());
      const payload = await response.json() as { results?: Array<Record<string, unknown>> };
      const papers = (payload.results ?? []).map((work): NormalizedPaper => {
        const openAlexId = text(work.id).split("/").pop() ?? text(work.id);
        const doi = text(work.doi).replace(/^https?:\/\/doi\.org\//, "");
        const location = work.primary_location as { landing_page_url?: string } | undefined;
        const authorships = (work.authorships as Array<{ author?: { display_name?: string } }> | undefined) ?? [];
        const primaryTopic = work.primary_topic as { display_name?: string } | undefined;
        const topics = (work.topics as Array<{ display_name?: string }> | undefined) ?? [];
        return {
          id: stableId("openalex", openAlexId), title: text(work.title), abstract: rebuildAbstract(work.abstract_inverted_index),
          primaryUrl: doi ? `https://doi.org/${doi}` : text(location?.landing_page_url) || text(work.id),
          authors: authorships.map((item) => text(item.author?.display_name)).filter(Boolean), publishedAt: text(work.publication_date),
          sources: ["OpenAlex"], categories: [...new Set([text(primaryTopic?.display_name), ...topics.map((topic) => text(topic.display_name))].filter(Boolean))],
          identifiers: { openAlex: openAlexId, doi: doi || undefined },
          metrics: { citationCount: typeof work.cited_by_count === "number" ? work.cited_by_count : 0 },
        };
      });
      return { source: this.name, papers, status: "ready" };
    } catch (error) {
      return { source: this.name, papers: [], status: "error", message: error instanceof Error ? error.message : "OpenAlex request failed" };
    }
  },
};

function decodeXml(value: string) {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&");
}
function tag(block: string, name: string) {
  return decodeXml(block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] ?? "").replace(/\s+/g, " ").trim();
}
function arxivEntries(xml: string): NormalizedPaper[] {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map((match) => {
    const block = match[1];
    const rawId = tag(block, "id");
    const arxivId = rawId.split("/abs/").pop()?.replace(/v\d+$/, "") ?? rawId;
    const authors = [...block.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/gi)].map((author) => decodeXml(author[1]).replace(/\s+/g, " ").trim());
    const categories = [...block.matchAll(/<category[^>]+term=["']([^"']+)["'][^>]*\/>/gi)].map((item) => item[1]);
    const doi = tag(block, "arxiv:doi");
    return {
      id: stableId("arxiv", arxivId), title: tag(block, "title"), abstract: tag(block, "summary"),
      primaryUrl: `https://arxiv.org/abs/${arxivId}`, authors, publishedAt: tag(block, "published").slice(0, 10),
      sources: ["arXiv"], categories, identifiers: { arxiv: arxivId, doi: doi || undefined },
    };
  });
}

export const arxivConnector: ResearchConnector = {
  name: "arXiv",
  async fetchRecent(since) {
    const stamp = (date: Date, end = false) => `${date.toISOString().slice(0, 10).replace(/-/g, "")}${end ? "2359" : "0000"}`;
    const url = new URL("https://export.arxiv.org/api/query");
    url.searchParams.set("search_query", `(${researchConfig.arxivQuery}) AND submittedDate:[${stamp(since)} TO ${stamp(new Date(), true)}]`);
    url.searchParams.set("start", "0"); url.searchParams.set("max_results", String(researchConfig.maxPapersPerSource));
    url.searchParams.set("sortBy", "submittedDate"); url.searchParams.set("sortOrder", "descending");
    try {
      const response = await request(url.toString());
      return { source: this.name, papers: arxivEntries(await response.text()), status: "ready" };
    } catch (error) {
      return { source: this.name, papers: [], status: "error", message: error instanceof Error ? error.message : "arXiv request failed" };
    }
  },
};

export const activeConnectors = [arxivConnector, openAlexConnector];
