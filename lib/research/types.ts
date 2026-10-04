export type FeedKind = "frontier" | "personalized";
export type PaperStatus = "unseen" | "saved" | "dismissed";

export type NormalizedPaper = {
  id: string;
  title: string;
  abstract: string;
  primaryUrl: string;
  authors: string[];
  publishedAt: string;
  sources: string[];
  categories: string[];
  identifiers: {
    arxiv?: string;
    doi?: string;
    openAlex?: string;
    semanticScholar?: string;
    openReview?: string;
  };
  metrics?: {
    citationCount?: number;
  };
};

export type RankedPaper = NormalizedPaper & {
  frontierScore: number;
  personalizedScore: number;
  reason: string;
  status?: PaperStatus;
};

export type ConnectorResult = {
  source: string;
  papers: NormalizedPaper[];
  status: "ready" | "missing-key" | "error";
  message?: string;
};

export type SourceSummary = {
  name: string;
  status: "ready" | "missing-key" | "disabled" | "error";
  message: string;
  count: number;
};

export interface ResearchConnector {
  name: string;
  fetchRecent(since: Date): Promise<ConnectorResult>;
}
