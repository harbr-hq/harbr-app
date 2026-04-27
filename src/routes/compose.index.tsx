import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageSpinner } from "@/components/ui/page-spinner";
import { ProjectRow } from "@/components/compose/compose-project-row";
import { NewProjectSheet } from "@/components/compose/new-compose-sheet";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/compose/")({
  component: ComposePage,
});

function ComposePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["compose"],
    queryFn: api.compose.list,
    refetchInterval: 5_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) => api.compose.remove(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["compose"] });
      toast.success("Project removed");
    },
    onError: (e) => toast.error(`Remove failed: ${e instanceof Error ? e.message : String(e)}`),
  });

  if (isLoading) {
    return <PageSpinner />;
  }

  if (isError) {
    return <p className="text-destructive">Failed to load compose projects: {error.message}</p>;
  }

  const projects = data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4 pl-4 pr-6">
        <div className="flex items-center gap-3 shrink-0">
          <h1 className="text-2xl font-semibold tracking-tight">Compose</h1>
          <span className="text-sm text-muted-foreground tabular-nums">
            ({projects.length})
          </span>
        </div>
        <div className="ml-auto">
          <NewProjectSheet
            onCreated={(projectName) => {
              void queryClient.invalidateQueries({ queryKey: ["compose"] });
              void navigate({ to: "/compose/$name", params: { name: projectName }, search: { tab: "services", autoUp: false } });
            }}
          />
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-12rem)]">
        <div className="flex flex-col gap-1.5 pr-4">
          {projects.length === 0 && (
            <p className="text-muted-foreground pl-4">
              No compose projects found. Create one or run a compose project to see it here.
            </p>
          )}
          {projects.map((project) => (
            <ProjectRow
              key={project.name}
              project={project}
              onDelete={(name) => deleteMutation.mutate(name)}
              isDeleting={deleteMutation.isPending && deleteMutation.variables === project.name}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
