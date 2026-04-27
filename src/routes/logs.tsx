import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowDown01, ArrowUp01 } from "lucide-react";
import { Plus, X } from "lucide-react";
import { api, type LogSearchResult } from "@/lib/api";
import { ResultRow, chipColour } from "@/components/logs/log-result-row";

// ─── Time preset helpers ───────────────────────────────────────────────────

type SincePreset = "1h" | "6h" | "24h" | "7d" | "all";

const SINCE_PRESETS: { value: SincePreset; label: string }[] = [
  { value: "1h", label: "1h" },
  { value: "6h", label: "6h" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "all", label: "All" },
];

function sinceToEpoch(preset: SincePreset): number | undefined {
  if (preset === "all") return undefined;
  const offsets: Record<Exclude<SincePreset, "all">, number> = {
    "1h": 3_600,
    "6h": 21_600,
    "24h": 86_400,
    "7d": 604_800,
  };
  return Math.floor(Date.now() / 1000) - offsets[preset];
}

// ─── Route — filter state lives in URL search params ─────────────────────

const PAGE_SIZE = 50;

type StreamFilter = "all" | "stdout" | "stderr";
type SortOrder = "desc" | "asc";

const STREAM_OPTIONS: { value: StreamFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "stdout", label: "stdout" },
  { value: "stderr", label: "stderr" },
];

export const Route = createFileRoute("/logs")({
  validateSearch: (search: Record<string, unknown>) => ({
    // Last-searched term (pushed to URL on Search click, not on every keystroke).
    q: typeof search.q === "string" ? search.q : "",
    // Comma-separated container IDs.
    cids: typeof search.cids === "string" ? search.cids : "",
    stream: (["all", "stdout", "stderr"] as const).includes(search.stream as StreamFilter)
      ? (search.stream as StreamFilter)
      : ("all" as StreamFilter),
    since: (["1h", "6h", "24h", "7d", "all"] as const).includes(search.since as SincePreset)
      ? (search.since as SincePreset)
      : ("all" as SincePreset),
    order: (["desc", "asc"] as const).includes(search.order as SortOrder)
      ? (search.order as SortOrder)
      : ("desc" as SortOrder),
  }),
  component: LogSearchPage,
});

function LogSearchPage() {
  const urlSearch = Route.useSearch();
  const navigate = useNavigate({ from: "/logs" });

  // term is local until Search is clicked — avoids URL churn on every keystroke.
  const [term, setTerm] = useState(urlSearch.q);

  // Derived from URL — these update the URL immediately so they survive navigation.
  const selectedIds = urlSearch.cids ? urlSearch.cids.split(",").filter(Boolean) : [];
  const stream = urlSearch.stream;
  const sincePreset = urlSearch.since;
  const order = urlSearch.order;

  // Result state is local — transient, re-fetched after navigation back.
  const [results, setResults] = useState<LogSearchResult[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [searchedTerm, setSearchedTerm] = useState(urlSearch.q);

  function setSelectedIds(updater: string[] | ((prev: string[]) => string[])) {
    const next = typeof updater === "function" ? updater(selectedIds) : updater;
    void navigate({ search: (prev) => ({ ...prev, cids: next.join(",") }), replace: true });
  }

  function setStream(s: StreamFilter) {
    void navigate({ search: (prev) => ({ ...prev, stream: s }), replace: true });
  }

  function setSincePreset(p: SincePreset) {
    void navigate({ search: (prev) => ({ ...prev, since: p }), replace: true });
  }

  function toggleOrder() {
    const next: SortOrder = order === "desc" ? "asc" : "desc";
    void navigate({ search: (prev) => ({ ...prev, order: next }), replace: true });
    setOffset(0);
    searchMutation.mutate({ off: 0, sortOrder: next });
  }

  const addContainer = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));

  const removeContainer = (id: string) =>
    setSelectedIds((prev) => prev.filter((x) => x !== id));

  const { data: containers = [] } = useQuery({
    queryKey: ["containers"],
    queryFn: api.containers.list,
    staleTime: 30_000,
  });

  const { data: loggedData } = useQuery({
    queryKey: ["logs", "containers"],
    queryFn: api.logs.loggedContainers,
    staleTime: 10_000,
  });
  const loggedIds = new Set(loggedData?.container_ids ?? []);

  function containerDisplayName(id: string): string {
    return containers.find((c) => c.id === id || c.id.startsWith(id))?.name ?? id.slice(0, 12);
  }

  // Only containers that have stored logs and haven't already been selected.
  const available = containers.filter(
    (c) => loggedIds.has(c.id) && !selectedIds.includes(c.id),
  );

  const searchMutation = useMutation({
    mutationFn: ({ off, sortOrder }: { off: number; sortOrder: SortOrder }) =>
      api.logs.search({
        term: term.trim() || undefined,
        container_ids: selectedIds,
        stream: stream === "all" ? undefined : stream,
        since_secs: sinceToEpoch(sincePreset),
        limit: PAGE_SIZE,
        offset: off,
        order: sortOrder,
      }),
    onSuccess: (data, { off }) => {
      if (off === 0) {
        setResults(data.results);
        setSearchedTerm(term.trim());
      } else {
        setResults((prev) => [...prev, ...data.results]);
      }
      setHasMore(data.has_more);
      setOffset(off + data.results.length);
    },
  });

  // Auto-search on mount if URL has saved filters from a previous visit.
  const didAutoSearch = useRef(false);
  useEffect(() => {
    if (!didAutoSearch.current && (urlSearch.q || urlSearch.cids)) {
      didAutoSearch.current = true;
      searchMutation.mutate({ off: 0, sortOrder: order });
    }
    // Intentionally run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch() {
    void navigate({ search: (prev) => ({ ...prev, q: term.trim() }), replace: true });
    setOffset(0);
    searchMutation.mutate({ off: 0, sortOrder: order });
  }

  const isPending = searchMutation.isPending;
  const isInitialSearch = isPending && offset === 0;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Log Search</h1>

      {/* ── Filter panel ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">

        {/* Container token selector */}
        <div className="flex flex-wrap items-center gap-1.5 min-h-8">
          {selectedIds.map((id) => (
            <span
              key={id}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${chipColour(id)}`}
            >
              {containerDisplayName(id)}
              <button
                type="button"
                onClick={() => removeContainer(id)}
                className="ml-0.5 rounded-full opacity-60 hover:opacity-100 transition-opacity"
                aria-label={`Remove ${containerDisplayName(id)}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs rounded-full">
                <Plus className="h-3 w-3" />
                {selectedIds.length === 0 ? "All containers" : "Add"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60 data-[state=closed]:duration-0">
              {loggedIds.size === 0 ? (
                <DropdownMenuItem disabled>No containers with stored logs</DropdownMenuItem>
              ) : available.length === 0 ? (
                <DropdownMenuItem disabled>All logged containers selected</DropdownMenuItem>
              ) : (
                available.map((c) => (
                  <DropdownMenuItem key={c.id} onSelect={() => addContainer(c.id)}>
                    <span
                      className={`mr-2 h-2 w-2 rounded-full shrink-0 ${chipColour(c.id).split(" ")[0]}`}
                    />
                    <span className="truncate">{c.name}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Search input + button */}
        <div className="flex gap-2">
          <SearchInput
            className="flex-1"
            placeholder="Search log lines…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onClear={() => setTerm("")}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
          />
          <Button onClick={handleSearch} disabled={isPending}>
            Search
          </Button>
        </div>

        {/* Stream + time range filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Stream</span>
            <SegmentedControl
              options={STREAM_OPTIONS}
              value={stream}
              onChange={(v) => setStream(v as StreamFilter)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Since</span>
            <SegmentedControl
              options={SINCE_PRESETS}
              value={sincePreset}
              onChange={(v) => setSincePreset(v as SincePreset)}
            />
          </div>
        </div>
      </div>

      {/* ── Results ───────────────────────────────────────────────── */}
      {searchMutation.isError && (
        <p className="text-sm text-destructive">
          Search failed — check that the daemon is running.
        </p>
      )}

      {isInitialSearch && (
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      )}

      {!isPending && searchMutation.isSuccess && results.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-16">No results found.</p>
      )}

      {results.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {results.length} result{results.length === 1 ? "" : "s"}
              {hasMore ? " (more available)" : ""}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={toggleOrder}
              disabled={isPending}
            >
              {order === "desc"
                ? <ArrowDown01 className="h-3.5 w-3.5" />
                : <ArrowUp01 className="h-3.5 w-3.5" />}
              {order === "desc" ? "Newest first" : "Oldest first"}
            </Button>
          </div>

          <ScrollArea className="h-[calc(100vh-420px)] min-h-64 rounded-lg border">
            <div className="divide-y">
              {results.map((r, i) => (
                <ResultRow
                  key={i}
                  result={r}
                  term={searchedTerm}
                  containerName={containerDisplayName(r.container_id)}
                />
              ))}
            </div>
          </ScrollArea>

          {hasMore && (
            <div className="flex justify-center pt-1">
              <Button
                variant="outline"
                onClick={() => searchMutation.mutate({ off: offset, sortOrder: order })}
                disabled={isPending}
              >
                {isPending ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
