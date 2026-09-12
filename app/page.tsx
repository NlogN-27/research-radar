"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, Atom, Bookmark, BrainCircuit, Check, ExternalLink, FlaskConical, LayoutGrid, RefreshCw, Search, Settings2, Sparkles, Telescope, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Feed = "frontier" | "personalized";
type PaperStatus = "unseen" | "saved" | "dismissed";
type Paper = { id: string; title: string; abstract: string; url: string; authors: string[]; publishedAt: string; sources: string[]; category: string; frontierScore: number; personalizedScore: number; reason: string };

const sources = [
  { name: "arXiv", count: 42, state: "Public API" },
  { name: "OpenAlex", count: 31, state: "Key pending" },
  { name: "Semantic Scholar", count: 18, state: "Key pending" },
  { name: "Hugging Face", count: 15, state: "Token pending" },
  { name: "OpenReview", count: 9, state: "Public API" },
];

const papers: Paper[] = [
  { id: "paper-1", title: "Retrieval-time integration of formulas, tables, and scientific diagrams", abstract: "A unified multimodal retrieval architecture grounds generation in equations, structured tables, and visual evidence without additional parameter updates.", url: "https://arxiv.org/", authors: ["A. Chen", "M. Rao", "L. Park"], publishedAt: "Sep 10, 2026", sources: ["arXiv", "OpenAlex", "Semantic Scholar"], category: "Scientific multimodal", frontierScore: 84, personalizedScore: 97, reason: "Matches your multimodal-science profile and three saved seed papers." },
  { id: "paper-2", title: "Test-time memory becomes a practical alternative to retraining", abstract: "Independent evaluations show that structured external memory can update model behavior rapidly while preserving prior capabilities across long-running tasks.", url: "https://openreview.net/", authors: ["S. Iyer", "J. Kim"], publishedAt: "Sep 9, 2026", sources: ["OpenReview", "Hugging Face"], category: "Emerging direction", frontierScore: 95, personalizedScore: 82, reason: "High cross-source momentum and direct relevance to dynamic knowledge integration." },
  { id: "paper-3", title: "Neuro-symbolic planning over scientific knowledge graphs", abstract: "The proposed planner combines learned representations with explicit rules and produces inspectable reasoning traces for scientific question answering.", url: "https://www.semanticscholar.org/", authors: ["R. Singh", "E. Torres", "Y. Wu"], publishedAt: "Sep 8, 2026", sources: ["Semantic Scholar", "OpenAlex"], category: "Planning & reasoning", frontierScore: 79, personalizedScore: 94, reason: "Strong collaborator fit with a reproducible evaluation opportunity." },
  { id: "paper-4", title: "Human-guided active learning for closed-loop materials discovery", abstract: "A small-data experimental agent uses human feedback to select, execute, and revise laboratory actions within a physical discovery platform.", url: "https://arxiv.org/", authors: ["N. Alvarez", "T. Brooks"], publishedAt: "Sep 7, 2026", sources: ["arXiv", "OpenAlex"], category: "Research agents", frontierScore: 76, personalizedScore: 91, reason: "Direct overlap with human-in-the-loop self-driving laboratory research." },
];

export default function Home() {
  const [feed, setFeed] = useState<Feed>("frontier");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [statuses, setStatuses] = useState<Record<string, PaperStatus>>({});
  const [syncing, setSyncing] = useState(false);

  const visiblePapers = useMemo(() => [...papers]
    .filter((paper) => statuses[paper.id] !== "dismissed")
    .filter((paper) => source === "all" || paper.sources.includes(source))
    .filter((paper) => `${paper.title} ${paper.abstract} ${paper.authors.join(" ")}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => feed === "frontier" ? b.frontierScore - a.frontierScore : b.personalizedScore - a.personalizedScore), [feed, query, source, statuses]);

  function updateStatus(id: string, status: PaperStatus) { setStatuses((current) => ({ ...current, [id]: status })); }
  async function runDemoSync() {
    setSyncing(true);
    try { await fetch("/api/sync", { method: "POST" }); }
    finally { window.setTimeout(() => setSyncing(false), 500); }
  }

  useEffect(() => {
    const modelContext = (document as Document & {
      modelContext?: {
        registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void>;
      };
    }).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();

    void Promise.resolve(modelContext.registerTool({
      name: "sync_research_sources",
      title: "Sync research sources",
      description: "Run the same research-source synchronization shown by the Sync now button.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async () => {
        setSyncing(true);
        const response = await fetch("/api/sync", { method: "POST" });
        const result = await response.json();
        setSyncing(false);
        return result;
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);

    void Promise.resolve(modelContext.registerTool({
      name: "set_paper_status",
      title: "Set paper status",
      description: "Save, dismiss, or restore a paper in the visible research queue.",
      inputSchema: {
        type: "object",
        properties: { paperId: { type: "string" }, status: { type: "string", enum: ["unseen", "saved", "dismissed"] } },
        required: ["paperId", "status"], additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input: unknown) => {
        const payload = input as { paperId?: string; status?: PaperStatus };
        if (!payload.paperId || !papers.some((paper) => paper.id === payload.paperId)) throw new Error("Unknown paperId");
        if (!payload.status || !["unseen", "saved", "dismissed"].includes(payload.status)) throw new Error("Invalid status");
        updateStatus(payload.paperId, payload.status);
        return { paperId: payload.paperId, status: payload.status };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);

    return () => lifecycle.abort();
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_28px_rgb(99_102_241/22%)]"><Telescope className="size-5" /></div>
            <div className="min-w-0"><div className="truncate text-[15px] font-semibold tracking-[-0.02em]">Research Radar</div><div className="text-xs text-muted-foreground">Local research intelligence</div></div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden gap-1.5 sm:inline-flex"><span className="size-1.5 rounded-full bg-amber-400" /> Demo data</Badge>
            <Dialog>
              <DialogTrigger asChild><Button variant="outline" size="sm" className="hidden sm:inline-flex"><Settings2 /> Sources</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Research sources</DialogTitle><DialogDescription>Credentials stay server-side in <code>.env.local</code>. Public connectors do not need a key.</DialogDescription></DialogHeader>
                <div className="space-y-2">
                  {sources.map((item) => <div key={item.name} className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5"><div><div className="text-sm font-medium">{item.name}</div><div className="text-xs text-muted-foreground">{item.state}</div></div><span className={`size-2 rounded-full ${item.state === "Public API" ? "bg-emerald-400" : "bg-amber-400"}`} /></div>)}
                </div>
                <div className="rounded-xl bg-muted p-3 font-mono text-xs leading-6 text-muted-foreground">OPENALEX_API_KEY=...<br />SEMANTIC_SCHOLAR_API_KEY=...<br />HF_TOKEN=...</div>
              </DialogContent>
            </Dialog>
            <Button size="sm" onClick={runDemoSync} disabled={syncing}>{syncing ? <RefreshCw className="animate-spin" /> : <RefreshCw />}{syncing ? "Syncing" : "Sync now"}</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="hidden min-h-[calc(100vh-4rem)] border-r border-border/70 px-4 py-7 lg:block">
          <p className="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Connected sources</p>
          <div className="mt-3 space-y-1">
            {sources.map((item) => (
              <button key={item.name} type="button" onClick={() => setSource(source === item.name ? "all" : item.name)} className={`group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors ${source === item.name ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"}`}>
                <span className="relative grid size-7 shrink-0 place-items-center rounded-lg border border-border bg-card"><Atom className="size-3.5 text-muted-foreground" /><span className={`absolute -right-0.5 -top-0.5 size-2 rounded-full ring-2 ring-background ${item.state === "Public API" ? "bg-emerald-400" : "bg-amber-400"}`} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.name}</span><span className="block truncate text-xs text-muted-foreground">{item.state}</span></span>
                <span className="text-xs tabular-nums text-muted-foreground">{item.count}</span>
              </button>
            ))}
          </div>
          <div className="my-6 h-px bg-border/70" />
          <p className="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Research profiles</p>
          <div className="mt-3 space-y-1 text-sm">
            {[[BrainCircuit, "Scientific multimodal"], [Sparkles, "Few-shot acquisition"], [LayoutGrid, "Planning & reasoning"], [FlaskConical, "Research agents"]].map(([Icon, label]) => { const ProfileIcon = Icon as typeof BrainCircuit; return <div key={label as string} className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-muted-foreground"><ProfileIcon className="size-4" /><span>{label as string}</span></div>; })}
          </div>
        </aside>

        <section className="min-w-0 px-4 py-7 sm:px-7 xl:px-10">
          <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><span>September 11, 2026</span><span aria-hidden="true">·</span><span>Last sync 18 min ago</span></div>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-[2.15rem]">What deserves your attention?</h1>
              <p className="mt-2 max-w-2xl text-[15px] leading-6 text-muted-foreground">One deduplicated reading queue across your research sources, ranked for significance or personal fit.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:flex">
              {[["128", "new papers"], ["9", "high signal"], [String(Object.values(statuses).filter((value) => value === "saved").length), "saved"]].map(([value, label]) => <div key={label} className="min-w-24 rounded-xl border border-border/80 bg-card/70 px-3.5 py-2.5"><div className="text-lg font-semibold tabular-nums">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>)}
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-3 border-b border-border/70 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={feed} onValueChange={(value) => setFeed(value as Feed)}><TabsList><TabsTrigger value="frontier"><Sparkles /> Frontier</TabsTrigger><TabsTrigger value="personalized"><BrainCircuit /> Personalized</TabsTrigger></TabsList></Tabs>
            <div className="flex flex-1 gap-2 sm:max-w-xl sm:justify-end">
              <div className="relative min-w-0 flex-1 sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this feed" className="pl-9" /></div>
              <Select value={source} onValueChange={setSource}><SelectTrigger className="max-w-40"><SelectValue placeholder="All sources" /></SelectTrigger><SelectContent><SelectItem value="all">All sources</SelectItem>{sources.map((item) => <SelectItem key={item.name} value={item.name}>{item.name}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {visiblePapers.map((paper, index) => {
              const score = feed === "frontier" ? paper.frontierScore : paper.personalizedScore;
              const saved = statuses[paper.id] === "saved";
              return <article key={paper.id} className="paper-card group relative overflow-hidden rounded-2xl border border-border/80 bg-card px-4 py-5 transition sm:px-5">
                <div className="absolute inset-y-0 left-0 w-1 bg-primary/20"><span className="block w-full bg-primary" style={{ height: `${score}%` }} /></div>
                <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_110px]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><Badge variant={index === 0 ? "default" : "secondary"}>{paper.category}</Badge>{paper.sources.map((paperSource) => <Badge key={paperSource} variant="outline">{paperSource}</Badge>)}<span className="text-xs text-muted-foreground">{paper.publishedAt}</span></div>
                    <h2 className="mt-3 text-lg font-semibold leading-7 tracking-[-0.018em]"><a href={paper.url} target="_blank" rel="noreferrer" className="transition-colors hover:text-primary">{paper.title} <ExternalLink className="ml-1 inline size-3.5 align-baseline opacity-45" /></a></h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{paper.abstract}</p>
                    <div className="mt-3 flex items-start gap-2 rounded-xl bg-accent/65 px-3 py-2.5 text-sm leading-5"><Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" /><span><strong className="font-medium">Why surfaced:</strong> {paper.reason}</span></div>
                    <div className="mt-3 text-xs text-muted-foreground">{paper.authors.join(" · ")}</div>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-4 sm:flex-col sm:items-end sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                    <div className="sm:text-right"><div className="text-3xl font-semibold tracking-[-0.05em] tabular-nums text-primary">{score}</div><div className="text-xs text-muted-foreground">{feed === "frontier" ? "signal score" : "personal fit"}</div></div>
                    <div className="flex gap-1.5"><Button variant={saved ? "default" : "outline"} size="icon-sm" onClick={() => updateStatus(paper.id, saved ? "unseen" : "saved")} aria-label={saved ? "Remove bookmark" : "Save paper"}>{saved ? <Check /> : <Bookmark />}</Button><Button variant="ghost" size="icon-sm" onClick={() => updateStatus(paper.id, "dismissed")} aria-label="Dismiss paper"><X /></Button></div>
                  </div>
                </div>
              </article>;
            })}
            {visiblePapers.length === 0 && <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center"><Archive className="mx-auto size-7 text-muted-foreground" /><p className="mt-3 font-medium">No matching papers</p><p className="mt-1 text-sm text-muted-foreground">Clear the search or choose another source.</p></div>}
          </div>
        </section>
      </div>
    </main>
  );
}
