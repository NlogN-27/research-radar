import { researchConfig } from "./config";
import type { ConnectorResult, NormalizedPaper, ResearchConnector } from "./types";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stableId(prefix: string, value: string) {
  return `${prefix}:${value.toLowerCase().replace(/[^a-z0-9.-]+/g, "-")}`;
}

function missingKey(source: string, variable: string): ConnectorResult {
  return { source, papers: [], status: "missing-key", message: `Add ${variable} to .env.local.` };
}

async function requestJson(url: string, headers?: HeadersInit) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json() as Promise<unknown>;
}

export const openAlexConnector: ResearchConnector = {
  name: "OpenAlex",
  async fetchRecent(since) {
    if (!researchConfig.openAlexKey) return missingKey(this.name, "OPENALEX_API_KEY");
    const filter = `from_publication_date:${since.toISOString().slice(0, 10)}`;
    const url = new URL("https://api.openalex.org/works");
    url.searchParams.set("filter", filter);
    url.searchParams.set("search", "large language model OR scientific reasoning OR multimodal");
    url.searchParams.set("per_page", String(researchConfig.maxPapersPerSource));
    url.searchParams.set("api_key", researchConfig.openAlexKey);
    try {
      const payload = await requestJson(url.toString()) as { results?: Array<Record<string, unknown>> };
      const papers = (payload.results ?? []).map((work): NormalizedPaper => {
        const id = text(work.id).split("/").pop() ?? text(work.id);
        const doi = text(work.doi).replace("https://doi.org/", "");
        const location = work.primary_location as { landing_page_url?: string } | undefined;
        const authorships = (work.authorships as Array<{ author?: { display_name?: string } }> | undefined) ?? [];
        return {
          id: stableId("openalex", id),
          title: text(work.title),
          abstract: "",
          primaryUrl: location?.landing_page_url ?? text(work.doi) ?? text(work.id),
          authors: authorships.map((item) => text(item.author?.display_name)).filter(Boolean),
          publishedAt: text(work.publication_date),
          sources: ["OpenAlex"],
          categories: [],
          identifiers: { openAlex: id, doi: doi || undefined },
        };
      });
      return { source: this.name, papers, status: "ready" };
    } catch (error) {
      return { source: this.name, papers: [], status: "error", message: error instanceof Error ? error.message : "OpenAlex request failed" };
    }
  },
};

export const semanticScholarConnector: ResearchConnector = {
  name: "Semantic Scholar",
  async fetchRecent(since) {
    if (!researchConfig.semanticScholarKey) return missingKey(this.name, "SEMANTIC_SCHOLAR_API_KEY");
    const url = new URL("https://api.semanticscholar.org/graph/v1/paper/search/bulk");
    url.searchParams.set("query", "large language model scientific multimodal reasoning agents");
    url.searchParams.set("year", `${since.getUTCFullYear()}-`);
    url.searchParams.set("fields", "paperId,title,abstract,url,authors,publicationDate,externalIds,fieldsOfStudy");
    try {
      const payload = await requestJson(url.toString(), { "x-api-key": researchConfig.semanticScholarKey }) as { data?: Array<Record<string, unknown>> };
      const papers = (payload.data ?? []).slice(0, researchConfig.maxPapersPerSource).map((paper): NormalizedPaper => {
        const externalIds = (paper.externalIds as Record<string, string> | undefined) ?? {};
        const authors = (paper.authors as Array<{ name?: string }> | undefined) ?? [];
        return {
          id: stableId("s2", text(paper.paperId)), title: text(paper.title), abstract: text(paper.abstract),
          primaryUrl: text(paper.url), authors: authors.map((author) => text(author.name)).filter(Boolean),
          publishedAt: text(paper.publicationDate), sources: ["Semantic Scholar"],
          categories: ((paper.fieldsOfStudy as string[] | undefined) ?? []).filter(Boolean),
          identifiers: { semanticScholar: text(paper.paperId), arxiv: externalIds.ArXiv, doi: externalIds.DOI },
        };
      });
      return { source: this.name, papers, status: "ready" };
    } catch (error) {
      return { source: this.name, papers: [], status: "error", message: error instanceof Error ? error.message : "Semantic Scholar request failed" };
    }
  },
};

export const huggingFaceConnector: ResearchConnector = {
  name: "Hugging Face",
  async fetchRecent() {
    if (!researchConfig.huggingFaceToken) return missingKey(this.name, "HF_TOKEN");
    return { source: this.name, papers: [], status: "ready", message: "Token configured; paper-artifact enrichment is ready for the next sync implementation." };
  },
};

export const arxivConnector: ResearchConnector = {
  name: "arXiv",
  async fetchRecent() {
    return { source: this.name, papers: [], status: "ready", message: "Public connector configured. Live requests remain disabled until ENABLE_LIVE_SYNC=true." };
  },
};

export const openReviewConnector: ResearchConnector = {
  name: "OpenReview",
  async fetchRecent() {
    return { source: this.name, papers: [], status: "ready", message: "Public connector configured. Venue-specific invitations can be added in settings." };
  },
};

export const connectors = [arxivConnector, openAlexConnector, semanticScholarConnector, huggingFaceConnector, openReviewConnector];
