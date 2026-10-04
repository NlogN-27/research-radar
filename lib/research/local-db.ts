import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { PaperStatus, RankedPaper, SourceSummary } from "./types";

const dataDirectory = path.join(process.cwd(), ".research-radar");
const databasePath = path.join(dataDirectory, "research-radar.sqlite");

type PaperRow = Record<string, unknown>;
type GlobalDatabase = typeof globalThis & { researchRadarDb?: DatabaseSync };

function database() {
  const scope = globalThis as GlobalDatabase;
  if (scope.researchRadarDb) return scope.researchRadarDb;
  mkdirSync(dataDirectory, { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS papers (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      abstract TEXT NOT NULL,
      primary_url TEXT NOT NULL,
      authors_json TEXT NOT NULL,
      published_at TEXT NOT NULL,
      sources_json TEXT NOT NULL,
      categories_json TEXT NOT NULL,
      identifiers_json TEXT NOT NULL,
      metrics_json TEXT NOT NULL,
      frontier_score INTEGER NOT NULL,
      personalized_score INTEGER NOT NULL,
      reason TEXT NOT NULL,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS paper_states (
      paper_id TEXT PRIMARY KEY REFERENCES papers(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK(status IN ('unseen', 'saved', 'dismissed')),
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      finished_at TEXT NOT NULL,
      status TEXT NOT NULL,
      since_at TEXT NOT NULL,
      source_results_json TEXT NOT NULL,
      message TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS papers_published_idx ON papers(published_at DESC);
    CREATE INDEX IF NOT EXISTS papers_frontier_idx ON papers(frontier_score DESC);
    CREATE INDEX IF NOT EXISTS papers_personalized_idx ON papers(personalized_score DESC);
  `);
  scope.researchRadarDb = db;
  return db;
}

function parseJson<T>(value: unknown, fallback: T): T {
  try { return JSON.parse(String(value)) as T; } catch { return fallback; }
}

function rowToPaper(row: PaperRow): RankedPaper {
  return {
    id: String(row.id), title: String(row.title), abstract: String(row.abstract), primaryUrl: String(row.primary_url),
    authors: parseJson<string[]>(row.authors_json, []), publishedAt: String(row.published_at),
    sources: parseJson<string[]>(row.sources_json, []), categories: parseJson<string[]>(row.categories_json, []),
    identifiers: parseJson<RankedPaper["identifiers"]>(row.identifiers_json, {}),
    metrics: parseJson<RankedPaper["metrics"]>(row.metrics_json, {}),
    frontierScore: Number(row.frontier_score), personalizedScore: Number(row.personalized_score), reason: String(row.reason),
    status: (row.status as PaperStatus | null) ?? "unseen",
  };
}

export function upsertPapers(papers: RankedPaper[]) {
  const db = database();
  const now = new Date().toISOString();
  const statement = db.prepare(`
    INSERT INTO papers (id,title,abstract,primary_url,authors_json,published_at,sources_json,categories_json,identifiers_json,metrics_json,frontier_score,personalized_score,reason,first_seen_at,last_seen_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title, abstract=excluded.abstract, primary_url=excluded.primary_url,
      authors_json=excluded.authors_json, published_at=excluded.published_at, sources_json=excluded.sources_json,
      categories_json=excluded.categories_json, identifiers_json=excluded.identifiers_json, metrics_json=excluded.metrics_json,
      frontier_score=excluded.frontier_score, personalized_score=excluded.personalized_score, reason=excluded.reason,
      last_seen_at=excluded.last_seen_at
  `);
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const paper of papers) statement.run(
      paper.id, paper.title, paper.abstract, paper.primaryUrl, JSON.stringify(paper.authors), paper.publishedAt,
      JSON.stringify(paper.sources), JSON.stringify(paper.categories), JSON.stringify(paper.identifiers), JSON.stringify(paper.metrics ?? {}),
      paper.frontierScore, paper.personalizedScore, paper.reason, now, now,
    );
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function listPapers() {
  const rows = database().prepare(`
    SELECT p.*, s.status FROM papers p LEFT JOIN paper_states s ON s.paper_id = p.id
    ORDER BY p.published_at DESC, p.frontier_score DESC LIMIT 500
  `).all() as PaperRow[];
  return rows.map(rowToPaper);
}

export function setPaperStatus(paperId: string, status: PaperStatus) {
  const result = database().prepare(`
    INSERT INTO paper_states (paper_id,status,updated_at) VALUES (?,?,?)
    ON CONFLICT(paper_id) DO UPDATE SET status=excluded.status, updated_at=excluded.updated_at
  `).run(paperId, status, new Date().toISOString());
  return result.changes > 0;
}

export function recordSync(input: { startedAt: string; status: "success" | "partial" | "error"; sinceAt: string; sources: SourceSummary[]; message: string }) {
  database().prepare(`INSERT INTO sync_runs (started_at,finished_at,status,since_at,source_results_json,message) VALUES (?,?,?,?,?,?)`)
    .run(input.startedAt, new Date().toISOString(), input.status, input.sinceAt, JSON.stringify(input.sources), input.message);
}

export function lastSuccessfulSync() {
  const row = database().prepare(`SELECT finished_at FROM sync_runs WHERE status IN ('success','partial') ORDER BY id DESC LIMIT 1`).get() as { finished_at?: string } | undefined;
  return row?.finished_at ?? null;
}

export function latestSourceSummaries() {
  const row = database().prepare(`SELECT source_results_json FROM sync_runs ORDER BY id DESC LIMIT 1`).get() as { source_results_json?: string } | undefined;
  return row?.source_results_json ? parseJson<SourceSummary[]>(row.source_results_json, []) : [];
}

export function dashboardData() {
  const papers = listPapers();
  return { papers, lastSync: lastSuccessfulSync(), sources: latestSourceSummaries() };
}

export const localDatabasePath = databasePath;
