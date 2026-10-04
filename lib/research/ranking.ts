import type { NormalizedPaper, RankedPaper } from "./types";

const personalThemes: Array<[string, string[]]> = [
  ["scientific multimodal models", ["scientific multimodal", "formula", "equation", "table", "chart", "diagram", "scientific document"]],
  ["few-shot knowledge acquisition", ["few-shot", "few shot", "knowledge acquisition", "information extraction", "limited annotation", "low-resource"]],
  ["scientific planning and reasoning", ["scientific reasoning", "planning", "knowledge graph", "logic rule", "neuro-symbolic", "explainable", "trustworthy"]],
  ["research agents and laboratories", ["research agent", "self-driving lab", "self driving lab", "closed-loop", "closed loop", "human-in-the-loop", "robotic laboratory", "physical world"]],
];
const frontierTerms = ["foundation model", "large language model", "reasoning model", "agent", "benchmark", "multimodal", "test-time", "inference-time", "long context", "open weight"];
function occurrences(content: string, terms: string[]) { return terms.reduce((sum, term) => sum + (content.includes(term) ? 1 : 0), 0); }

export function rankPaper(paper: NormalizedPaper): RankedPaper {
  const title = paper.title.toLowerCase();
  const body = `${paper.abstract} ${paper.categories.join(" ")}`.toLowerCase();
  const themeMatches = personalThemes.map(([theme, terms]) => ({ theme, score: occurrences(title, terms) * 16 + occurrences(body, terms) * 6 }))
    .filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
  const personalizedScore = Math.round(Math.min(100, 18 + themeMatches.reduce((sum, item) => sum + item.score, 0)));
  const parsedDate = new Date(paper.publishedAt).getTime();
  const daysOld = Number.isFinite(parsedDate) ? Math.max(0, (Date.now() - parsedDate) / 86_400_000) : 30;
  const recency = Math.max(0, 28 - daysOld * 1.5);
  const keywordSignal = occurrences(title, frontierTerms) * 12 + occurrences(body, frontierTerms) * 4;
  const citations = Math.min(20, Math.log2((paper.metrics?.citationCount ?? 0) + 1) * 5);
  const crossSource = Math.max(0, paper.sources.length - 1) * 10;
  const frontierScore = Math.round(Math.min(100, 20 + recency + keywordSignal + citations + crossSource));
  const reason = themeMatches.length
    ? `Matches ${themeMatches.slice(0, 2).map((item) => item.theme).join(" and ")}.`
    : paper.sources.length > 1 ? `Detected by ${paper.sources.length} independent sources with recent frontier-AI signals.`
      : "Recent work containing frontier-AI signals from a connected scholarly source.";
  return { ...paper, frontierScore, personalizedScore, reason };
}
