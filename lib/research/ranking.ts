import type { NormalizedPaper, RankedPaper } from "./types";

const personalTerms = [
  "scientific", "multimodal", "formula", "table", "chart", "knowledge acquisition",
  "few-shot", "planning", "reasoning", "explainable", "self-driving laboratory",
  "closed-loop", "human-in-the-loop", "robotic laboratory",
];

const frontierTerms = ["foundation model", "large language model", "reasoning", "agent", "benchmark", "multimodal", "open weights"];

function keywordScore(paper: NormalizedPaper, terms: string[]) {
  const content = `${paper.title} ${paper.abstract} ${paper.categories.join(" ")}`.toLowerCase();
  const matches = terms.filter((term) => content.includes(term)).length;
  return Math.min(100, 48 + matches * 9 + Math.min(12, paper.sources.length * 4));
}

export function rankPaper(paper: NormalizedPaper): RankedPaper {
  const personalizedScore = keywordScore(paper, personalTerms);
  const frontierScore = keywordScore(paper, frontierTerms);
  const reason = personalizedScore >= frontierScore
    ? "Strong overlap with your scientific-AI research profile."
    : "Multiple frontier-AI signals appear in the title and abstract.";
  return { ...paper, personalizedScore, frontierScore, reason };
}
