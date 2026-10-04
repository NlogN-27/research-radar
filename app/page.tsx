"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Atom, Bookmark, BrainCircuit, Check, ExternalLink, FlaskConical, LayoutGrid, LoaderCircle, RefreshCw, Search, Settings2, Sparkles, Telescope, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Feed = "frontier" | "personalized";
type PaperStatus = "unseen" | "saved" | "dismissed";
type Paper = {
  id: string; title: string; abstract: string; primaryUrl: string; authors: string[]; publishedAt: string;
  sources: string[]; categories: string[]; frontierScore: number; personalizedScore: number; reason: string; status?: PaperStatus;
};
type SourceSummary = { name: string; status: "ready" | "missing-key" | "disabled" | "error"; message: string; count: number };
type DashboardData = { papers: Paper[]; lastSync: string | null; sources: SourceSummary[]; sync?: { status: string; message: string; received: number }; error?: string };

const fallbackSources: SourceSummary[] = [
  { name: "arXiv", status: "ready", message: "Public API · ready to sync", count: 0 },
  { name: "OpenAlex", status: "ready", message: "API key configured", count: 0 },
];

function formatDate(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date) : value;
}

function formatPaperDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date) : value;
}

export default function Home() {
  const [feed, setFeed] = useState<Feed>("frontier");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [papers, setPapers] = useState<Paper[]>([]);
  const [sources, setSources] = useState<SourceSummary[]>(fallbackSources);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const applyData = useCallback((data: DashboardData) => {
    setPapers(data.papers ?? []);
    if (data.sources?.length) setSources(data.sources);
    setLastSync(data.lastSync ?? null);
  }, []);

  useEffect(() => {
    fetch("/api/papers", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Could not load the local library.");
      applyData(await response.json() as DashboardData);
    }).catch((error) => setNotice(error instanceof Error ? error.message : "Could not load the local library."))
      .finally(() => setLoading(false));
  }, [applyData]);

  const runSync = useCallback(async () => {
    setSyncing(true); setNotice(null);
    try {
      const response = await fetch("/api/sync", { method: "POST" });
      const data = await response.json() as DashboardData;
      applyData(data);
      if (!response.ok) throw new Error(data.error ?? data.sync?.message ?? "Sync failed.");
      setNotice(data.sync?.message ?? "Sync complete.");
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed.";
      setNotice(message); throw error;
    } finally { setSyncing(false); }
  }, [applyData]);

  const updateStatus = useCallback(async (id: string, status: PaperStatus) => {
    const previous = papers.find((paper) => paper.id === id)?.status ?? "unseen";
    setPapers((current) => current.map((paper) => paper.id === id ? { ...paper, status } : paper));
    const response = await fetch("/api/papers/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paperId: id, status }) });
    if (!response.ok) {
      setPapers((current) => current.map((paper) => paper.id === id ? { ...paper, status: previous } : paper));
      throw new Error("Could not save that reading status.");
    }
    return { paperId: id, status };
  }, [papers]);

  useEffect(() => {
    const modelContext = (document as Document & { modelContext?: { registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(modelContext.registerTool({
      name: "sync_research_sources", title: "Sync research sources", description: "Fetch, deduplicate, rank, and save recent papers from the active sources.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: runSync,
    }, { signal: lifecycle.signal })).catch(() => undefined);
    void Promise.resolve(modelContext.registerTool({
      name: "set_paper_status", title: "Set paper status", description: "Save, dismiss, or restore a paper in the local reading queue.",
      inputSchema: { type: "object", properties: { paperId: { type: "string" }, status: { type: "string", enum: ["unseen", "saved", "dismissed"] } }, required: ["paperId", "status"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input: unknown) => { const value = input as { paperId: string; status: PaperStatus }; return updateStatus(value.paperId, value.status); },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [runSync, updateStatus]);

  const visiblePapers = useMemo(() => papers
    .filter((paper) => paper.status !== "dismissed")
    .filter((paper) => source === "all" || paper.sources.includes(source))
    .filter((paper) => `${paper.title} ${paper.abstract} ${paper.authors.join(" ")}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => feed === "frontier" ? b.frontierScore - a.frontierScore : b.personalizedScore - a.personalizedScore), [feed, papers, query, source]);
  const savedCount = papers.filter((paper) => paper.status === "saved").length;
  const highSignal = papers.filter((paper) => Math.max(paper.frontierScore, paper.personalizedScore) >= 75).length;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_28px_rgb(99_102_241/22%)]"><Telescope className="size-5" /></div><div className="min-w-0"><div className="truncate text-[15px] font-semibold tracking-[-0.02em]">Research Radar</div><div className="text-xs text-muted-foreground">Local research intelligence</div></div></div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden gap-1.5 sm:inline-flex"><span className="size-1.5 rounded-full bg-emerald-400" /> Local data</Badge>
            <Dialog><DialogTrigger asChild><Button variant="outline" size="sm" className="hidden sm:inline-flex"><Settings2 /> Sources</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Research sources</DialogTitle><DialogDescription>Only active sources are called. Credentials stay server-side in <code>.env.local</code>.</DialogDescription></DialogHeader><div className="space-y-2">{sources.map((item) => <div key={item.name} className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5"><div><div className="text-sm font-medium">{item.name}</div><div className="text-xs text-muted-foreground">{item.message}</div></div><div className="flex items-center gap-2"><span className="text-xs tabular-nums text-muted-foreground">{item.count}</span><span className={`size-2 rounded-full ${item.status === "ready" ? "bg-emerald-400" : "bg-rose-400"}`} /></div></div>)}</div><div className="rounded-xl bg-muted p-3 text-xs leading-5 text-muted-foreground">Manual sync only. Metadata is stored in a private local SQLite file; PDFs stay with the publisher.</div></DialogContent></Dialog>
            <Button size="sm" onClick={() => void runSync().catch(() => undefined)} disabled={syncing}>{syncing ? <RefreshCw className="animate-spin" /> : <RefreshCw />}{syncing ? "Syncing" : "Sync now"}</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="hidden min-h-[calc(100vh-4rem)] border-r border-border/70 px-4 py-7 lg:block">
          <p className="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Active sources</p><div className="mt-3 space-y-1">{sources.map((item) => <button key={item.name} type="button" onClick={() => setSource(source === item.name ? "all" : item.name)} className={`group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors ${source === item.name ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"}`}><span className="relative grid size-7 shrink-0 place-items-center rounded-lg border border-border bg-card"><Atom className="size-3.5 text-muted-foreground" /><span className={`absolute -right-0.5 -top-0.5 size-2 rounded-full ring-2 ring-background ${item.status === "ready" ? "bg-emerald-400" : "bg-rose-400"}`} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.name}</span><span className="block truncate text-xs text-muted-foreground">{item.message}</span></span><span className="text-xs tabular-nums text-muted-foreground">{item.count}</span></button>)}</div>
          <div className="my-6 h-px bg-border/70" /><p className="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Research profiles</p><div className="mt-3 space-y-1 text-sm">{[[BrainCircuit, "Scientific multimodal"], [Sparkles, "Few-shot acquisition"], [LayoutGrid, "Planning & reasoning"], [FlaskConical, "Research agents"]].map(([Icon, label]) => { const ProfileIcon = Icon as typeof BrainCircuit; return <div key={label as string} className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-muted-foreground"><ProfileIcon className="size-4" /><span>{label as string}</span></div>; })}</div>
        </aside>

        <section className="min-w-0 px-4 py-7 sm:px-7 xl:px-10">
          <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end"><div><div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><span>{new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date())}</span><span aria-hidden="true">·</span><span>Last sync {formatDate(lastSync)}</span></div><h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-[2.15rem]">What deserves your attention?</h1><p className="mt-2 max-w-2xl text-[15px] leading-6 text-muted-foreground">A deduplicated local reading queue, ranked for field-wide significance or your scientific-AI research direction.</p></div><div className="grid grid-cols-3 gap-2 sm:flex">{[[String(papers.length), "papers"], [String(highSignal), "high signal"], [String(savedCount), "saved"]].map(([value, label]) => <div key={label} className="min-w-24 rounded-xl border border-border/80 bg-card/70 px-3.5 py-2.5"><div className="text-lg font-semibold tabular-nums">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>)}</div></div>
          {notice && <div className="mt-5 rounded-xl border border-border bg-muted/60 px-4 py-3 text-sm text-muted-foreground">{notice}</div>}
          <div className="mt-7 flex flex-col gap-3 border-b border-border/70 pb-5 sm:flex-row sm:items-center sm:justify-between"><Tabs value={feed} onValueChange={(value) => setFeed(value as Feed)}><TabsList><TabsTrigger value="frontier"><Sparkles /> Frontier</TabsTrigger><TabsTrigger value="personalized"><BrainCircuit /> Personalized</TabsTrigger></TabsList></Tabs><div className="flex flex-1 gap-2 sm:max-w-xl sm:justify-end"><div className="relative min-w-0 flex-1 sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this feed" className="pl-9" /></div><Select value={source} onValueChange={setSource}><SelectTrigger className="max-w-40"><SelectValue placeholder="All sources" /></SelectTrigger><SelectContent><SelectItem value="all">All sources</SelectItem>{sources.map((item) => <SelectItem key={item.name} value={item.name}>{item.name}</SelectItem>)}</SelectContent></Select></div></div>

          <div className="mt-5 space-y-3">
            {visiblePapers.map((paper, index) => { const score = feed === "frontier" ? paper.frontierScore : paper.personalizedScore; const saved = paper.status === "saved"; return <article key={paper.id} className="paper-card group relative overflow-hidden rounded-2xl border border-border/80 bg-card px-4 py-5 transition sm:px-5"><div className="absolute inset-y-0 left-0 w-1 bg-primary/20"><span className="block w-full bg-primary" style={{ height: `${score}%` }} /></div><div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_110px]"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant={index === 0 ? "default" : "secondary"}>{paper.categories[0] ?? "AI research"}</Badge>{paper.sources.map((paperSource) => <Badge key={paperSource} variant="outline">{paperSource}</Badge>)}<span className="text-xs text-muted-foreground">{formatPaperDate(paper.publishedAt)}</span></div><h2 className="mt-3 text-lg font-semibold leading-7 tracking-[-0.018em]"><a href={paper.primaryUrl} target="_blank" rel="noreferrer" className="transition-colors hover:text-primary">{paper.title} <ExternalLink className="ml-1 inline size-3.5 align-baseline opacity-45" /></a></h2><p className="mt-2 line-clamp-4 text-sm leading-6 text-muted-foreground">{paper.abstract || "No abstract was supplied by this source."}</p><div className="mt-3 flex items-start gap-2 rounded-xl bg-accent/65 px-3 py-2.5 text-sm leading-5"><Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" /><span><strong className="font-medium">Why surfaced:</strong> {paper.reason}</span></div><div className="mt-3 line-clamp-1 text-xs text-muted-foreground">{paper.authors.join(" · ") || "Authors unavailable"}</div></div><div className="flex items-center justify-between gap-3 border-t border-border/70 pt-4 sm:flex-col sm:items-end sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0"><div className="sm:text-right"><div className="text-3xl font-semibold tracking-[-0.05em] tabular-nums text-primary">{score}</div><div className="text-xs text-muted-foreground">{feed === "frontier" ? "signal score" : "personal fit"}</div></div><div className="flex gap-1.5"><Button variant={saved ? "default" : "outline"} size="icon-sm" onClick={() => void updateStatus(paper.id, saved ? "unseen" : "saved").catch((error) => setNotice(error.message))} aria-label={saved ? "Remove bookmark" : "Save paper"}>{saved ? <Check /> : <Bookmark />}</Button><Button variant="ghost" size="icon-sm" onClick={() => void updateStatus(paper.id, "dismissed").catch((error) => setNotice(error.message))} aria-label="Dismiss paper"><X /></Button></div></div></div></article>; })}
            {loading && <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center"><LoaderCircle className="mx-auto size-7 animate-spin text-muted-foreground" /><p className="mt-3 font-medium">Loading your local library</p></div>}
            {!loading && visiblePapers.length === 0 && <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center"><Archive className="mx-auto size-7 text-muted-foreground" /><p className="mt-3 font-medium">{papers.length ? "No matching papers" : "Your radar is ready"}</p><p className="mt-1 text-sm text-muted-foreground">{papers.length ? "Clear the search or choose another source." : "Choose Sync now to fetch real papers from arXiv and OpenAlex."}</p></div>}
          </div>
        </section>
      </div>
    </main>
  );
}
