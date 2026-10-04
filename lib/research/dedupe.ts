import type { NormalizedPaper } from "./types";

function normalizedTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function keyFor(paper: NormalizedPaper) {
  if (paper.identifiers.doi) return `doi:${paper.identifiers.doi.toLowerCase()}`;
  if (paper.identifiers.arxiv) return `arxiv:${paper.identifiers.arxiv.toLowerCase()}`;
  return `title:${normalizedTitle(paper.title)}`;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function preferredUrl(a: NormalizedPaper, b: NormalizedPaper) {
  const candidates = [a.primaryUrl, b.primaryUrl];
  return candidates.find((url) => url.includes("doi.org"))
    ?? candidates.find((url) => url.includes("arxiv.org/abs/"))
    ?? candidates.find(Boolean)
    ?? "";
}

export function deduplicatePapers(papers: NormalizedPaper[]) {
  const merged = new Map<string, NormalizedPaper>();
  for (const paper of papers.filter((item) => item.title && item.primaryUrl)) {
    const key = keyFor(paper);
    const current = merged.get(key);
    if (!current) {
      merged.set(key, { ...paper, id: key });
      continue;
    }
    merged.set(key, {
      ...current,
      id: key,
      abstract: paper.abstract.length > current.abstract.length ? paper.abstract : current.abstract,
      primaryUrl: preferredUrl(current, paper),
      authors: unique([...current.authors, ...paper.authors]),
      publishedAt: current.publishedAt || paper.publishedAt,
      sources: unique([...current.sources, ...paper.sources]),
      categories: unique([...current.categories, ...paper.categories]),
      identifiers: { ...current.identifiers, ...paper.identifiers },
      metrics: { citationCount: Math.max(current.metrics?.citationCount ?? 0, paper.metrics?.citationCount ?? 0) },
    });
  }
  return [...merged.values()];
}
