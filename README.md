# Research Radar

Research Radar is a private, local-first reading queue for frontier AI and a focused scientific-AI research program. It fetches paper metadata, deduplicates overlapping records, applies transparent ranking rules, and stores only metadata and reading state on your computer.

## Current capabilities

- Real paper retrieval from arXiv, OpenAlex, and OpenReview
- Manual-only synchronization through **Sync now**
- DOI, arXiv ID, and normalized-title deduplication
- Two explainable rankings: **Frontier** and **Personalized**
- Local search, source filtering, saving, and dismissing
- Durable SQLite storage for titles, abstracts, links, scores, and reading status
- Exponential backoff for rate limits and transient source errors
- No PDF downloads, cloud database, scheduled job, or local language model

The personalized ranking targets scientific multimodal models, few-shot scientific knowledge acquisition, scientific planning/reasoning, and research agents or self-driving laboratories. Edit `lib/research/ranking.ts` to change those rules.

## Start on Windows

Double-click `start-research-radar.cmd` from the project folder or use the existing Start-menu shortcut. The launcher opens `http://localhost:5173` once the server is ready. Keep its terminal window open while using the dashboard; press Ctrl+C to stop it.

From PowerShell, the equivalent commands are:

```powershell
Set-Location ".\research-radar"
pnpm dev
```

Node.js 22.13 or newer is required. The launcher can use the bundled Codex Node.js runtime when ordinary Node.js is unavailable.

## Private configuration

Real credentials belong only in `.env.local`, which is ignored by Git. The committed `.env.example` contains empty fields:

```env
ENABLE_LIVE_SYNC=true
OPENALEX_API_KEY=
SEMANTIC_SCHOLAR_API_KEY=
HF_TOKEN=
ARXIV_QUERY=cat:cs.AI OR cat:cs.CL OR cat:cs.LG OR cat:cs.CV OR cat:cs.RO
MAX_PAPERS_PER_SOURCE=25
```

arXiv and OpenReview require no key. OpenReview searches recent public submissions across the major participating venues, with balanced queries for LLMs, multimodality, reasoning, research agents, scientific AI, and current ICLR few-shot work. Semantic Scholar is intentionally skipped, and the Hugging Face token is reserved for future artifact enrichment. API keys never enter browser responses.

## Local data

The database is created automatically at `.research-radar/research-radar.sqlite`. The entire `.research-radar` directory is ignored by Git, including SQLite journal files. Delete that directory only if you intentionally want to reset the local paper library and all saved/dismissed states.

On the first sync, the app requests the previous eight days. Later syncs continue from the last successful sync with a one-day overlap so weekly manual use does not create gaps. Up to 500 stored papers are shown in the dashboard.

## Ranking

No language model is required. Scores combine deterministic signals:

- Frontier: recency, frontier keywords, citation count, and cross-source agreement
- Personalized: weighted matches to the four configured research themes

The displayed “Why surfaced” note is generated from the matched rule group, making the result inspectable and inexpensive to run.

## Development checks

```powershell
pnpm lint
pnpm build
```

API routes:

- `GET /api/papers` — stored papers, last sync, and latest source results
- `POST /api/sync` — fetch, normalize, deduplicate, rank, and persist
- `POST /api/papers/status` — persist unseen/saved/dismissed state
- `GET /api/sources` — configuration and latest connector status
