import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ComposeOutput } from "@/components/compose/compose-output";
import { useComposeOutput } from "@/hooks/use-compose-output";
import { ArrowUp, RotateCcw } from "lucide-react";

export function ServicesTab({ name, autoUp = false }: { name: string; autoUp?: boolean }) {
  const navigate = useNavigate();
  const [activeOpUrl, setActiveOpUrl] = useState<string | null>(null);
  const { lines, exitCode, running, clear } = useComposeOutput(activeOpUrl);
  const autoUpFired = useRef(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ["compose", name],
    queryFn: () => api.compose.inspect(name),
    refetchInterval: 5_000,
  });

  function handleUp() {
    setActiveOpUrl(`${api.compose.upWsUrl(name)}&_t=${Date.now()}`);
  }

  // Auto-trigger up once when navigating here after project creation.
  useEffect(() => {
    if (autoUp && !autoUpFired.current && project?.status === "file_only") {
      autoUpFired.current = true;
      handleUp();
    }
  }, [autoUp, project?.status]);

  function handleRestart(serviceName: string) {
    const url = `${api.compose.restartWsUrl(name)}&service=${encodeURIComponent(serviceName)}&_t=${Date.now()}`;
    setActiveOpUrl(url);
  }

  if (isLoading || !project) {
    return (
      <div className="flex flex-col gap-2 mt-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const showOutput = running || lines.length > 0 || exitCode !== null;

  // No containers exist yet — prompt to start.
  if (project.status === "file_only") {
    return (
      <div className="flex flex-col gap-3 mt-3">
        <div className="flex items-center justify-between rounded-lg border border-dashed px-4 py-4">
          <div>
            <p className="text-sm font-medium">No services running</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Compose file is ready — run <span className="font-mono">up</span> to start all services.
            </p>
          </div>
          <Button size="sm" onClick={handleUp} disabled={running} className="gap-1.5 shrink-0">
            <ArrowUp className="h-3.5 w-3.5" />
            Start project
          </Button>
        </div>
        {showOutput && (
          <ComposeOutput
            lines={lines}
            exitCode={exitCode}
            running={running}
            onClear={() => { clear(); setActiveOpUrl(null); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 mt-3">
      {project.services.map((svc) => (
        <div
          key={svc.name}
          className="flex items-center gap-4 rounded-lg border px-4 py-3 text-sm"
        >
          <span
            className={`h-2 w-2 rounded-full shrink-0 ${svc.status === "running" ? "bg-green-500" : "bg-muted-foreground/40"}`}
          />
          <span className="font-medium w-40 truncate shrink-0">{svc.name}</span>
          <span className="text-muted-foreground truncate flex-1">
            {svc.image ?? "—"}
          </span>
          {svc.ports.length > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              {svc.ports.map((p) => (
                <Badge key={p} variant="outline" className="font-mono text-xs px-1.5 py-0">
                  {p}
                </Badge>
              ))}
            </div>
          )}
          {svc.status === "running" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
              disabled={running}
              onClick={() => handleRestart(svc.name)}
              title={`Restart ${svc.name}`}
            >
              <RotateCcw className={`h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} />
            </Button>
          )}
          {svc.container_id && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs shrink-0"
              onClick={() =>
                void navigate({
                  to: "/containers/$id",
                  params: { id: svc.container_id! },
                  search: { tab: "logs", from: name },
                })
              }
            >
              Container
            </Button>
          )}
        </div>
      ))}

      {showOutput && (
        <div className="mt-2">
          <ComposeOutput
            lines={lines}
            exitCode={exitCode}
            running={running}
            onClear={() => { clear(); setActiveOpUrl(null); }}
          />
        </div>
      )}
    </div>
  );
}
