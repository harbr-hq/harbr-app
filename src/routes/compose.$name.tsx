import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Activity } from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ServicesTab } from "@/components/compose/services-tab";
import { FileTab } from "@/components/compose/file-tab";
import { LogsTab } from "@/components/compose/logs-tab";
import { ComposeActions, statusDot, statusLabel } from "@/components/compose/compose-project-row";
import { useConfirm } from "@/hooks/use-confirm";
import { api } from "@/lib/api";
import { ArrowLeft, Trash2 } from "lucide-react";

export const Route = createFileRoute("/compose/$name")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === "string" ? search.tab : "services",
    autoUp: search.autoUp === true || search.autoUp === "1",
  }),
  component: ComposeDetailPage,
});

function ComposeDetailPage() {
  const { name } = Route.useParams();
  const { tab: initialTab, autoUp } = Route.useSearch();
  const [activeTab, setActiveTab] = useState(initialTab);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm, dialog } = useConfirm();

  const { data: project } = useQuery({
    queryKey: ["compose", name],
    queryFn: () => api.compose.inspect(name),
    refetchInterval: 5_000,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.compose.remove(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["compose"] });
      void navigate({ to: "/compose" });
    },
  });

  return (
    <>
    <div className="flex flex-col gap-4">
      {/* Breadcrumb + actions */}
      <div className="flex items-center gap-2">
        <Link
          to="/compose"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-muted-foreground text-sm">Compose</span>
        <span className="text-muted-foreground text-sm">/</span>
        <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
        {project && (
          <>
            {statusDot(project.status)}
            <span className="text-xs text-muted-foreground">{statusLabel(project.status)}</span>
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          {project && <ComposeActions project={project} />}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={async () => {
              const ok = await confirm({
                title: "Delete project?",
                description: project?.file_managed
                  ? `"${name}" and its compose file will be permanently deleted.`
                  : `All containers for "${name}" will be stopped and removed.`,
                confirmLabel: "Delete",
              });
              if (ok) deleteMutation.mutate();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="file">File</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <Activity mode={activeTab === "services" ? "visible" : "hidden"}>
          <ServicesTab name={name} autoUp={autoUp} />
        </Activity>

        <Activity mode={activeTab === "file" ? "visible" : "hidden"}>
          <FileTab name={name} />
        </Activity>

        {/* CSS hide for logs — keeps WebSocket alive across tab switches */}
        <div className={activeTab === "logs" ? "" : "hidden"}>
          <LogsTab name={name} active={activeTab === "logs"} />
        </div>
      </Tabs>
    </div>
    {dialog}
    </>
  );
}
