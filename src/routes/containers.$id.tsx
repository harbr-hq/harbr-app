import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity } from "react";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Play, Square } from "lucide-react";
import { useContainerStats } from "@/hooks/use-container-stats";
import { useMinPending } from "@/hooks/use-min-pending";
import { TerminalPanel } from "@/components/terminal-panel";
import { DetailsPanel } from "@/components/containers/container-details-panel";
import { LogsPanel } from "@/components/containers/container-logs-panel";
import { InsightsPanel } from "@/components/containers/container-insights-panel";
import { statusVariant } from "./containers.index";
import { api, type Container } from "@/lib/api";
import { toast } from "sonner";
import { openUrl } from "@tauri-apps/plugin-opener";

export const Route = createFileRoute("/containers/$id")({
  validateSearch: (search: Record<string, unknown>): { tab: string; from?: string } => ({
    tab: typeof search.tab === "string" ? search.tab : "logs",
    ...(typeof search.from === "string" ? { from: search.from } : {}),
  }),
  component: ContainerDetailPage,
});

function ContainerDetailPage() {
  const { id } = Route.useParams();
  const { tab: initialTab, from } = Route.useSearch();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Incremented each time the container transitions to running so LogsPanel
  // remounts and opens a fresh WebSocket connection.
  const [runSession, setRunSession] = useState(0);
  const prevStatusRef = useRef<string | undefined>(undefined);

  const [activeTab, setActiveTab] = useState(initialTab);
  // Lazily mount the terminal so the session persists on tab switches.
  const [terminalMounted, setTerminalMounted] = useState(initialTab === "terminal");

  // useQuery (not getQueryData) so the component re-renders when the cache
  // updates after a start/stop mutation invalidates the query.
  const { data: containers = [] } = useQuery({
    queryKey: ["containers"],
    queryFn: api.containers.list,
    refetchInterval: 5000,
  });
  const container = containers.find(
    (c) => c.id === id || c.id.startsWith(id),
  );

  // Detect running transition and bump the session counter.
  useEffect(() => {
    if (container?.status === "running" && prevStatusRef.current !== "running") {
      setRunSession((n) => n + 1);
    }
    prevStatusRef.current = container?.status;
  }, [container?.status]);

  // Keep stats running at the page level so switching to the Logs tab
  // doesn't kill the WebSocket and lose the rolling history.
  const statsData = useContainerStats(
    container?.status === "running" ? id : "",
  );

  // Optimistic status — badge and buttons update immediately on click.
  const [optimisticStatus, addOptimistic] = useOptimistic(
    container?.status,
    (_: Container["status"] | undefined, next: Container["status"]) => next,
  );
  const displayStatus = optimisticStatus ?? container?.status;

  const [isStopping, setIsStopping] = useState(false);
  const [stopTransPending, startStopTrans] = useTransition();
  const [startTransPending, startStartTrans] = useTransition();

  const stopPending = useMinPending(stopTransPending) || isStopping;
  const startPending = useMinPending(startTransPending);

  // Clear isStopping once the container actually leaves the running state.
  useEffect(() => {
    if (isStopping && container?.status !== "running") {
      setIsStopping(false);
    }
  }, [container?.status, isStopping]);

  function handleStop() {
    setIsStopping(true);
    startStopTrans(async () => {
      addOptimistic("stopped");
      await api.containers.stop(id);
      await queryClient.invalidateQueries({ queryKey: ["containers"] });
    });
  }

  function handleStart() {
    startStartTrans(async () => {
      addOptimistic("running");
      try {
        await api.containers.start(id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      }
      await queryClient.invalidateQueries({ queryKey: ["containers"] });
    });
  }

  const isRunning = displayStatus === "running";
  const canStart = displayStatus === "exited" || displayStatus === "stopped";

  return (
    <div className="flex flex-col gap-4">
      {/* Row 1: back · name · status · actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => from
            ? void router.navigate({ to: "/compose/$name", params: { name: from }, search: { tab: "services", autoUp: false } })
            : void router.navigate({ to: "/containers" })
          }
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-2xl font-semibold tracking-tight truncate">
          {container?.name ?? id.slice(0, 12)}
        </h1>
        {displayStatus && (
          <Badge variant={statusVariant(displayStatus)}>
            {displayStatus}
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-2">
          {stopPending ? (
            <Button variant="destructive" size="sm" disabled>
              <Square className="h-3 w-3" />
              Stopping…
            </Button>
          ) : startPending ? (
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled>
              <Play className="h-3 w-3" />
              Starting…
            </Button>
          ) : isRunning ? (
            <Button variant="destructive" size="sm" onClick={handleStop}>
              <Square className="h-3 w-3" />
              Stop
            </Button>
          ) : canStart ? (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleStart}
            >
              <Play className="h-3 w-3" />
              Start
            </Button>
          ) : null}
        </div>
      </div>

      {/* Row 2: image · port badges */}
      {container && (
        <div className="flex items-center gap-3 -mt-2">
          <span className="text-sm text-muted-foreground truncate">{container.image}</span>
          {container.ports.length > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              {container.ports.map((p) => {
                const hostPort = p.split(":")[0];
                const port = parseInt(hostPort, 10);
                const url = port === 443 ? `https://localhost:${port}` : `http://localhost:${port}`;
                return (
                  <Badge
                    key={p}
                    variant="outline"
                    className="font-mono text-xs px-1.5 py-0 cursor-pointer transition-colors bg-sky-50 text-sky-700 border-sky-300 hover:bg-sky-100 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/30 dark:hover:bg-sky-500/20"
                    onClick={() => void openUrl(url)}
                    title={`Open ${url}`}
                  >
                    {p}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
      )}


      <Tabs
        value={activeTab}
        onValueChange={(tab) => {
          if (tab === "terminal") setTerminalMounted(true);
          setActiveTab(tab);
        }}
        className="flex-1"
      >
        <TabsList>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="terminal">Terminal</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {/* Activity preserves log buffer and scroll position across tab switches.
            Effects (WebSocket) still unmount when hidden — logs reconnect on return
            but the buffered lines survive. Better than Radix TabsContent which
            fully unmounts and loses everything. */}
        <Activity mode={activeTab === "logs" ? "visible" : "hidden"}>
          <div className="mt-3">
            <LogsPanel key={runSession} containerId={id} isRunning={isRunning} />
          </div>
        </Activity>

        {/* Stats hook lives at page level so data accumulates regardless of active tab.
            Activity just pauses chart rendering updates when hidden. */}
        <Activity mode={activeTab === "insights" ? "visible" : "hidden"}>
          <div className="mt-3">
            <InsightsPanel
              statsData={statsData}
              isRunning={container?.status === "running"}
              containerId={id}
              isCompose={!!container?.compose_project}
            />
          </div>
        </Activity>

        {/* Terminal uses CSS hide, not Activity — Activity unmounts effects which
            would close the WebSocket and kill the PTY session. */}
        <div className={activeTab === "terminal" ? "mt-3" : "hidden"}>
          {terminalMounted && (
            container?.status === "running" ? (
              <TerminalPanel containerId={id} isActive={activeTab === "terminal"} />
            ) : (
              <p className="text-muted-foreground">
                Container is not running — start it to open a terminal.
              </p>
            )
          )}
        </div>

        <Activity mode={activeTab === "details" ? "visible" : "hidden"}>
          <DetailsPanel containerId={id} />
        </Activity>
      </Tabs>
    </div>
  );
}
