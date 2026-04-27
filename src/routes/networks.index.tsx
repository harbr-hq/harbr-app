import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useOptimistic, useState, useTransition } from "react";
import { api, type Network } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageSpinner } from "@/components/ui/page-spinner";
import { NetworkRow } from "@/components/networks/network-row";
import { CreateNetworkSheet } from "@/components/networks/create-network-sheet";
import { useConfirm } from "@/hooks/use-confirm";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/networks/")({
  component: NetworksPage,
});

export function NetworksPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const { confirm, dialog } = useConfirm();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["networks"],
    queryFn: api.networks.list,
    refetchInterval: 30_000,
  });

  const [isSpinning, setIsSpinning] = useState(false);

  function handleRefresh() {
    setIsSpinning(true);
    void refetch().finally(() => setTimeout(() => setIsSpinning(false), 600));
  }

  const [optimisticNetworks, removeOptimistic] = useOptimistic(
    data ?? [],
    (current: Network[], id: string) => current.filter((n) => n.id !== id),
  );

  const [, startRemoveTrans] = useTransition();

  function handleRemove(id: string) {
    startRemoveTrans(async () => {
      removeOptimistic(id);
      try {
        await api.networks.remove(id);
        await queryClient.invalidateQueries({ queryKey: ["networks"] });
      } catch (e) {
        toast.error(`Remove failed: ${e instanceof Error ? e.message : String(e)}`);
        await queryClient.invalidateQueries({ queryKey: ["networks"] });
      }
    });
  }

  const pruneMutation = useMutation({
    mutationFn: api.networks.prune,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["networks"] });
      toast.success(
        `Pruned ${result.deleted_count} network${result.deleted_count === 1 ? "" : "s"}`,
      );
    },
    onError: (e) =>
      toast.error(`Prune failed: ${e instanceof Error ? e.message : String(e)}`),
  });

  const deferredSearch = useDeferredValue(search);

  const filtered = useMemo(() => {
    if (!deferredSearch) return optimisticNetworks;
    const q = deferredSearch.toLowerCase();
    return optimisticNetworks.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        n.driver.toLowerCase().includes(q) ||
        (n.subnet ?? "").includes(q),
    );
  }, [optimisticNetworks, deferredSearch]);

  if (isLoading) {
    return <PageSpinner />;
  }

  if (isError) {
    return <p className="text-destructive">Failed to load networks: {error.message}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-4 pl-4 pr-6">
        <div className="flex items-center gap-3 shrink-0">
          <h1 className="text-2xl font-semibold tracking-tight">Networks</h1>
          <span className="text-sm text-muted-foreground tabular-nums">
            ({filtered.length}/{data?.length ?? 0})
          </span>
        </div>

        <div className="flex-1 flex justify-center px-4">
          <SearchInput
            placeholder="Search networks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
            className="max-w-sm"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefresh}
            disabled={isSpinning}
            className="h-9 w-9 p-0"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSpinning ? "animate-spin" : ""}`} />
          </Button>
          <CreateNetworkSheet
            onCreated={() => void queryClient.invalidateQueries({ queryKey: ["networks"] })}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const ok = await confirm({
                title: "Prune unused networks?",
                description: "All networks not connected to any container will be permanently removed.",
                confirmLabel: "Prune",
              });
              if (ok) pruneMutation.mutate();
            }}
            disabled={pruneMutation.isPending}
          >
            {pruneMutation.isPending ? "Pruning…" : "Prune"}
          </Button>
        </div>
      </div>

      {/* List */}
      <ScrollArea className="h-[calc(100vh-12rem)]">
        <div className="flex flex-col gap-1.5 pr-4">
          {filtered.length === 0 && (
            <p className="text-muted-foreground pl-4">
              {search ? "No networks match the filter." : "No networks found."}
            </p>
          )}
          {filtered.map((network) => (
            <NetworkRow key={network.id} network={network} onRemove={handleRemove} />
          ))}
        </div>
      </ScrollArea>
      {dialog}
    </div>
  );
}
