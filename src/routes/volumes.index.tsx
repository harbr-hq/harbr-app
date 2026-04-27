import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useDeferredValue,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import { api, type Volume } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageSpinner } from "@/components/ui/page-spinner";
import { VolumeRow } from "@/components/volumes/volume-row";
import { CreateVolumeSheet } from "@/components/volumes/create-volume-sheet";
import { useConfirm } from "@/hooks/use-confirm";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/volumes/")({
  component: VolumesPage,
});

export function VolumesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const { confirm, dialog } = useConfirm();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["volumes"],
    queryFn: api.volumes.list,
    refetchInterval: 30_000,
  });

  const [isSpinning, setIsSpinning] = useState(false);

  function handleRefresh() {
    setIsSpinning(true);
    void refetch().finally(() => {
      // Hold the spin for at least 600 ms so there's visible feedback.
      setTimeout(() => setIsSpinning(false), 600);
    });
  }

  const [optimisticVolumes, removeOptimistic] = useOptimistic(
    data ?? [],
    (current: Volume[], name: string) => current.filter((v) => v.name !== name),
  );

  const [, startRemoveTrans] = useTransition();

  function handleRemove(name: string) {
    startRemoveTrans(async () => {
      removeOptimistic(name);
      try {
        await api.volumes.remove(name);
        await queryClient.invalidateQueries({ queryKey: ["volumes"] });
      } catch (e) {
        toast.error(`Remove failed: ${e instanceof Error ? e.message : String(e)}`);
        await queryClient.invalidateQueries({ queryKey: ["volumes"] });
      }
    });
  }

  const pruneMutation = useMutation({
    mutationFn: api.volumes.prune,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["volumes"] });
      toast.success(
        `Pruned ${result.deleted_count} volume${result.deleted_count === 1 ? "" : "s"}, freed ${formatBytes(result.space_reclaimed)}`,
      );
    },
    onError: (e) =>
      toast.error(`Prune failed: ${e instanceof Error ? e.message : String(e)}`),
  });

  const deferredSearch = useDeferredValue(search);

  const filtered = useMemo(() => {
    if (!deferredSearch) return optimisticVolumes;
    const q = deferredSearch.toLowerCase();
    return optimisticVolumes.filter(
      (v) => v.name.toLowerCase().includes(q) || v.driver.toLowerCase().includes(q),
    );
  }, [optimisticVolumes, deferredSearch]);

  if (isLoading) {
    return <PageSpinner />;
  }

  if (isError) {
    return <p className="text-destructive">Failed to load volumes: {error.message}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-4 pl-4 pr-6">
        <div className="flex items-center gap-3 shrink-0">
          <h1 className="text-2xl font-semibold tracking-tight">Volumes</h1>
          <span className="text-sm text-muted-foreground tabular-nums">
            ({filtered.length}/{data?.length ?? 0})
          </span>
        </div>

        <div className="flex-1 flex justify-center px-4">
          <SearchInput
            placeholder="Search volumes…"
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
          <CreateVolumeSheet
            onCreated={() => void queryClient.invalidateQueries({ queryKey: ["volumes"] })}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const ok = await confirm({
                title: "Prune unused volumes?",
                description: "All volumes not currently used by any container will be permanently removed and their data lost.",
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
              {search ? "No volumes match the filter." : "No volumes found."}
            </p>
          )}
          {filtered.map((volume) => (
            <VolumeRow key={volume.name} volume={volume} onRemove={handleRemove} />
          ))}
        </div>
      </ScrollArea>
      {dialog}
    </div>
  );
}
