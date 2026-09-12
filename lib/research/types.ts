export type FeedKind = "frontier" | "personalized";

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
};

export type RankedPaper = NormalizedPaper & {
  frontierScore: number;
  personalizedScore: number;
  reason: string;
};

export type ConnectorResult = {
  source: string;
  papers: NormalizedPaper[];
  status: "ready" | "missing-key" | "error";
  message?: string;
};

export interface ResearchConnector {
  name: string;
  fetchRecent(since: Date): Promise<ConnectorResult>;
}
