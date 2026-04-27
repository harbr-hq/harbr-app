import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { api } from "@/lib/api";
import { ContainerRow, statusVariant } from "@/components/containers/container-row";
import { GroupedView } from "@/components/containers/grouped-view";
import { RunContainerSheet } from "@/components/containers/container-run-sheet";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchInput } from "@/components/ui/search-input";
import { PageSpinner } from "@/components/ui/page-spinner";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Layers, Play, Plus, Square } from "lucide-react";
import { useLocalStorage } from "@/hooks/use-local-storage";

// Re-export for consumers (e.g. detail page) that need the status variant helper.
export { statusVariant };

// Route component returns null — ContainersLayout in containers.tsx
// always renders ContainersPage directly so it can be kept alive across
// list ↔ detail navigation using <Activity>.
export const Route = createFileRoute("/containers/")({
  component: () => null,
});

export function ContainersPage() {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [runningOnly, setRunningOnly] = useState(false);
  const [grouped, setGrouped] = useLocalStorage("harbr:containers:grouped", false);
  const [runOpen, setRunOpen] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["containers"],
    queryFn: api.containers.list,
    refetchInterval: 5000,
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["containers"] });

  const filtered = (data ?? []).filter((c) => {
    if (runningOnly && c.status !== "running") return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.id.slice(0, 12).includes(q) ||
        c.image.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectMany = (ids: string[], select: boolean) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (select) ids.forEach((id) => next.add(id));
      else ids.forEach((id) => next.delete(id));
      return next;
    });

  const allSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));
  const someSelected = filtered.some((c) => selectedIds.has(c.id)) && !allSelected;

  const toggleAll = () =>
    allSelected
      ? setSelectedIds((prev) => {
          const next = new Set(prev);
          filtered.forEach((c) => next.delete(c.id));
          return next;
        })
      : setSelectedIds((prev) => new Set([...prev, ...filtered.map((c) => c.id)]));

  const bulkStop = useMutation({
    mutationFn: () =>
      Promise.all(
        [...selectedIds]
          .filter((id) => data?.find((c) => c.id === id)?.status === "running")
          .map((id) => api.containers.stop(id)),
      ),
    onSuccess: invalidate,
  });

  const bulkStart = useMutation({
    mutationFn: () =>
      Promise.all(
        [...selectedIds]
          .filter((id) => {
            const s = data?.find((c) => c.id === id)?.status;
            return s === "exited" || s === "stopped";
          })
          .map((id) => api.containers.start(id)),
      ),
    onSuccess: invalidate,
  });

  const runningCount = data?.filter((c) => c.status === "running").length ?? 0;
  const bulkPending = bulkStop.isPending || bulkStart.isPending;

  // Detect host-port collisions across all running containers (unfiltered).
  // Port strings are formatted as "0.0.0.0:8080->80/tcp" or ":::8080->80/tcp".
  // Split on "->" first to isolate the host side, then take the last ":" segment.
  const conflictingPorts = useMemo<Set<number>>(() => {
    // Track which container IDs use each host port.
    // Port strings from the backend are "host_port:container_port/proto", e.g. "8080:80/tcp".
    // Host port is always the first segment before the colon.
    const portContainers = new Map<number, Set<string>>();
    for (const c of data ?? []) {
      if (c.status !== "running") continue;
      for (const p of c.ports) {
        const port = parseInt(p.split(":")[0], 10);
        if (!isNaN(port) && port > 0) {
          if (!portContainers.has(port)) portContainers.set(port, new Set());
          portContainers.get(port)!.add(c.id);
        }
      }
    }
    const result = new Set<number>();
    for (const [port, ids] of portContainers) {
      if (ids.size > 1) result.add(port);
    }
    return result;
  }, [data]);
  const selectedCount = filtered.filter((c) => selectedIds.has(c.id)).length;

  if (isLoading) {
    return <PageSpinner />;
  }

  if (isError) {
    return (
      <p className="text-destructive">
        Failed to load containers: {error.message}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: checkbox | title | counts | running toggle | flex-1 | bulk | run container */}
      <div className="flex items-center gap-3 pl-4 pr-6">
        <Checkbox
          checked={someSelected ? "indeterminate" : allSelected}
          onCheckedChange={toggleAll}
          aria-label="Select all visible containers"
        />
        <h1 className="text-2xl font-semibold tracking-tight">Containers</h1>
        <span className="text-sm text-muted-foreground tabular-nums">
          ({selectedCount}/{filtered.length})
        </span>
        <span className="text-xs text-muted-foreground hidden sm:block shrink-0">
          {runningCount} running
        </span>
        <label className="flex items-center gap-2 cursor-pointer select-none ml-2 shrink-0">
          <Switch checked={runningOnly} onCheckedChange={setRunningOnly} />
          <span className="text-xs text-muted-foreground">Show running</span>
        </label>

        {conflictingPorts.size > 0 && (
          <span className="hidden sm:flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 ml-1" title="Multiple running containers share the same host port">
            <AlertTriangle className="h-3 w-3" />
            {conflictingPorts.size} port conflict{conflictingPorts.size !== 1 ? "s" : ""}
          </span>
        )}

        <div className="flex-1" />

        {selectedCount > 0 && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="text-green-500 border-green-500/40 hover:bg-green-500/10"
              disabled={bulkPending}
              onClick={() => bulkStart.mutate()}
            >
              <Play className="h-3 w-3" />
              {bulkStart.isPending ? "Starting…" : "Start"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-500 border-red-500/40 hover:bg-red-500/10"
              disabled={bulkPending}
              onClick={() => bulkStop.mutate()}
            >
              <Square className="h-3 w-3" />
              {bulkStop.isPending ? "Stopping…" : "Stop"}
            </Button>
          </>
        )}

        <Button size="sm" onClick={() => setRunOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Run container
        </Button>
      </div>

      {/* Row 2: search | separator | grouped toggle */}
      <div className="flex items-center gap-3 pl-4 pr-6">
        <SearchInput
          placeholder="Search containers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch("")}
          className="flex-1"
        />
        <Separator orientation="vertical" className="h-5 shrink-0" />
        <Button
          variant={grouped ? "secondary" : "ghost"}
          size="icon"
          className="h-9 w-9"
          onClick={() => setGrouped((g) => !g)}
          title="Toggle grouped view"
        >
          <Layers className="h-4 w-4" />
        </Button>
      </div>

      {grouped ? (
        <GroupedView
          containers={filtered}
          selectedIds={selectedIds}
          conflictingPorts={conflictingPorts}
          onToggle={toggleSelect}
          onSelectMany={selectMany}
          onRemoved={(id) =>
            setSelectedIds((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            })
          }
        />
      ) : (
        <div className="flex flex-col gap-1.5 pr-4">
          {filtered.length === 0 && (
            <p className="text-muted-foreground pl-4">
              {search || runningOnly
                ? "No containers match the filter."
                : "No containers found."}
            </p>
          )}
          {filtered.map((container) => (
            <ContainerRow
              key={container.id}
              container={container}
              selected={selectedIds.has(container.id)}
              conflictingPorts={conflictingPorts}
              onToggle={() => toggleSelect(container.id)}
              onRemoved={() =>
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  next.delete(container.id);
                  return next;
                })
              }
            />
          ))}
        </div>
      )}

      <RunContainerSheet open={runOpen} onOpenChange={setRunOpen} />
    </div>
  );
}
