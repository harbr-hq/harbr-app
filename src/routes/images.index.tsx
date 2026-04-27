import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useOptimistic, useTransition } from "react";
import { useState } from "react";
import { api, type Image } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageSpinner } from "@/components/ui/page-spinner";
import { ImageRow } from "@/components/images/image-row";
import { PullSheet } from "@/components/images/pull-sheet";
import { useConfirm } from "@/hooks/use-confirm";
import { toast } from "sonner";

export const Route = createFileRoute("/images/")({
  component: ImagesPage,
});

export function ImagesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const { confirm, dialog } = useConfirm();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["images"],
    queryFn: api.images.list,
    refetchInterval: 30_000,
  });

  // Optimistic remove — image vanishes from the list immediately on action.
  const [optimisticImages, removeOptimistic] = useOptimistic(
    data ?? [],
    (current: Image[], id: string) => current.filter((img) => img.id !== id),
  );

  const [, startRemoveTrans] = useTransition();

  function handleRemove(id: string, force: boolean) {
    startRemoveTrans(async () => {
      removeOptimistic(id);
      try {
        await api.images.remove(id, force);
        await queryClient.invalidateQueries({ queryKey: ["images"] });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`Remove failed: ${msg}`);
        await queryClient.invalidateQueries({ queryKey: ["images"] });
      }
    });
  }

  const pruneMutation = useMutation({
    mutationFn: api.images.prune,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["images"] });
      toast.success(
        `Pruned ${result.deleted_count} image${result.deleted_count === 1 ? "" : "s"}, freed ${formatBytes(result.space_reclaimed)}`,
      );
    },
    onError: (e) => toast.error(`Prune failed: ${e instanceof Error ? e.message : String(e)}`),
  });

  // useDeferredValue keeps the input snappy when filtering a large image list.
  const deferredSearch = useDeferredValue(search);

  const filtered = useMemo(() => {
    if (!deferredSearch) return optimisticImages;
    const q = deferredSearch.toLowerCase();
    return optimisticImages.filter(
      (img) =>
        img.repo_tags.some((t) => t.toLowerCase().includes(q)) ||
        img.id.toLowerCase().includes(q),
    );
  }, [optimisticImages, deferredSearch]);

  if (isLoading) {
    return <PageSpinner />;
  }

  if (isError) {
    return (
      <p className="text-destructive">Failed to load images: {error.message}</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-4 pl-4 pr-6">
        <div className="flex items-center gap-3 shrink-0">
          <h1 className="text-2xl font-semibold tracking-tight">Images</h1>
          <span className="text-sm text-muted-foreground tabular-nums">
            ({filtered.length}/{data?.length ?? 0})
          </span>
        </div>

        <div className="flex-1 flex justify-center px-4">
          <SearchInput
            placeholder="Search images…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
            className="max-w-sm"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <PullSheet
            onDone={() => void queryClient.invalidateQueries({ queryKey: ["images"] })}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const ok = await confirm({
                title: "Prune unused images?",
                description: "All images not used by any container will be permanently removed.",
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
              {search ? "No images match the filter." : "No images found."}
            </p>
          )}
          {filtered.map((image) => (
            <ImageRow key={image.id} image={image} onRemove={handleRemove} />
          ))}
        </div>
      </ScrollArea>
      {dialog}
    </div>
  );
}
