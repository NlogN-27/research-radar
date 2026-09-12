export const researchConfig = {
  liveSync: process.env.ENABLE_LIVE_SYNC === "true",
  openAlexKey: process.env.OPENALEX_API_KEY ?? "",
  semanticScholarKey: process.env.SEMANTIC_SCHOLAR_API_KEY ?? "",
  huggingFaceToken: process.env.HF_TOKEN ?? "",
  arxivQuery:
    process.env.ARXIV_QUERY ??
    "cat:cs.AI OR cat:cs.CL OR cat:cs.LG OR cat:cs.CV OR cat:cs.RO",
  maxPapersPerSource: Number(process.env.MAX_PAPERS_PER_SOURCE ?? 25),
};

export function connectorStatuses() {
  return [
    { name: "arXiv", configured: true, credential: "Public API" },
    { name: "OpenAlex", configured: Boolean(researchConfig.openAlexKey), credential: "OPENALEX_API_KEY" },
    { name: "Semantic Scholar", configured: Boolean(researchConfig.semanticScholarKey), credential: "SEMANTIC_SCHOLAR_API_KEY" },
    { name: "Hugging Face", configured: Boolean(researchConfig.huggingFaceToken), credential: "HF_TOKEN" },
    { name: "OpenReview", configured: true, credential: "Public API" },
  ];
}
