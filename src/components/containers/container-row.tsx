import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOptimistic, useTransition, useEffect } from "react";
import { useState } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { api, type Container, type StatsSnapshot } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowRight,
  ChevronRight,
  Copy,
  EllipsisVertical,
  Info,
  LayoutDashboard,
  Pause,
  Play,
  ScrollText,
  Square,
  Terminal,
  Trash2,
} from "lucide-react";
import { useMinPending } from "@/hooks/use-min-pending";
import { usePendingAction } from "@/hooks/use-pending-actions";
import { useConfirm } from "@/hooks/use-confirm";
import { formatDistanceToNow } from "date-fns";

export function statusVariant(
  status: Container["status"],
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "running":
      return "default";
    case "exited":
    case "stopped":
      return "secondary";
    case "paused":
      return "outline";
    default:
      return "destructive";
  }
}

/** Animated green pulse dot for running, grey circle for stopped. */
export function StatusDot({ status }: { status: Container["status"] }) {
  if (status === "running") {
    return (
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
      </span>
    );
  }
  return <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground/30" />;
}

/** Thin horizontal progress bar. */
function MiniBar({ value, colour }: { value: number; colour: string }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${pct}%`,
          minWidth: pct > 0 ? "4px" : "0",
          background: colour,
        }}
      />
    </div>
  );
}

/** Expanded detail panel — fetches stats snapshot on first open. */
function ExpandedPanel({
  container,
  snapshot,
  conflictingPorts,
}: {
  container: Container;
  snapshot: StatsSnapshot | undefined;
  conflictingPorts?: Set<number>;
}) {
  const uptime = container.created
    ? formatDistanceToNow(new Date(container.created * 1000), { addSuffix: true })
    : "—";

  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-3 px-4 py-3 text-sm border-t border-border/50">
      {/* Ports */}
      <div>
        <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Ports</p>
        {container.ports.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {container.ports.map((p) => {
              const hostPort = p.split(":")[0];
              const port = parseInt(hostPort, 10);
              const url = port === 443
                ? `https://localhost:${port}`
                : `http://localhost:${port}`;
              const conflict = conflictingPorts?.has(port);
              return (
                <Badge
                  key={p}
                  variant="outline"
                  className={conflict
                    ? "font-mono text-xs px-1.5 py-0 cursor-pointer transition-colors bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30 dark:hover:bg-amber-500/20"
                    : "font-mono text-xs px-1.5 py-0 cursor-pointer transition-colors bg-sky-50 text-sky-700 border-sky-300 hover:bg-sky-100 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/30 dark:hover:bg-sky-500/20"}
                  onClick={(e) => {
                    e.stopPropagation();
                    void openUrl(url);
                  }}
                  title={conflict ? `Port conflict on ${port} — ${url}` : `Open ${url}`}
                >
                  {p}
                </Badge>
              );
            })}
          </div>
        ) : (
          <span className="text-muted-foreground">None exposed</span>
        )}
      </div>

      {/* Created */}
      <div>
        <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Created</p>
        <span>{uptime}</span>
      </div>

      {/* CPU */}
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">CPU</p>
          {snapshot
            ? <span className="text-xs tabular-nums">{snapshot.cpu_percent.toFixed(1)}%</span>
            : <Skeleton className="h-3 w-10" />}
        </div>
        {snapshot
          ? <MiniBar value={snapshot.cpu_percent} colour="var(--chart-orange)" />
          : <Skeleton className="h-1.5 w-full rounded-full" />}
      </div>

      {/* Memory */}
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Memory</p>
          {snapshot
            ? <span className="text-xs tabular-nums">
                {snapshot.memory_limit > 0
                  ? `${formatBytes(snapshot.memory_usage)} / ${formatBytes(snapshot.memory_limit)}`
                  : `${formatBytes(snapshot.memory_usage)} (no limit)`}
              </span>
            : <Skeleton className="h-3 w-24" />}
        </div>
        {snapshot
          ? snapshot.memory_limit > 0
            ? <MiniBar value={snapshot.memory_percent} colour="var(--chart-purple)" />
            : <div className="h-1.5 w-full rounded-full bg-muted" />
          : <Skeleton className="h-1.5 w-full rounded-full" />}
      </div>

      {/* Image (full) */}
      <div className="col-span-2">
        <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Image</p>
        <span className="font-mono text-xs break-all">{container.image}</span>
      </div>
    </div>
  );
}

export interface RowProps {
  container: Container;
  selected: boolean;
  onToggle: () => void;
  onRemoved: () => void;
  /** Optional drag handle props — spread onto the drag handle icon only. */
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
  /** Host port numbers that collide with another running container. */
  conflictingPorts?: Set<number>;
  /** Groups to show in the "Move to" submenu. Only provided in grouped view. */
  moveToGroups?: Array<{ id: string; name: string }>;
  onMoveTo?: (targetGroupId: string) => void;
}

export function ContainerRow({
  container,
  selected,
  onToggle,
  onRemoved,
  dragHandleProps,
  conflictingPorts,
  moveToGroups,
  onMoveTo,
}: RowProps) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm, dialog } = useConfirm();

  // Local confirmed status — set after an action API call succeeds (fire-and-forget).
  // Persists across the transition boundary so the row doesn't snap back to the
  // server state while Podman is still catching up. Cleared once the cache agrees.
  const [confirmedStatus, setConfirmedStatus] = useState<Container["status"] | null>(null);

  useEffect(() => {
    if (confirmedStatus === null) return;
    const settled =
      (confirmedStatus === "exited" &&
        (container.status === "exited" || container.status === "stopped")) ||
      (confirmedStatus === "running" && container.status === "running") ||
      (confirmedStatus === "paused" && container.status === "paused");
    if (settled) setConfirmedStatus(null);
  }, [container.status, confirmedStatus]);

  const [optimisticStatus, addOptimistic] = useOptimistic(
    container.status,
    (_: Container["status"], next: Container["status"]) => next,
  );

  // confirmedStatus wins over optimistic (persists after transition ends);
  // optimistic wins over server state (shows feedback during in-flight actions).
  const displayStatus: Container["status"] = confirmedStatus ?? optimisticStatus;

  const isRunning = displayStatus === "running";
  const isPaused = displayStatus === "paused";
  const canStart = displayStatus === "exited" || displayStatus === "stopped";

  const { data: snapshot } = useQuery({
    queryKey: ["stats-snapshot", container.id],
    queryFn: () => api.containers.statsSnapshot(container.id),
    enabled: open && isRunning,
    refetchInterval: 5_000,
    staleTime: 4_000,
  });

  const [stopTransPending, startStopTrans] = useTransition();
  const [startTransPending, startStartTrans] = useTransition();
  const [pauseTransPending, startPauseTrans] = useTransition();
  const [unpauseTransPending, startUnpauseTrans] = useTransition();

  // Tray-initiated actions surface here so the row shows the same pending UI
  // as in-row buttons. Cleared on `containers-changed` event in __root.
  const trayAction = usePendingAction(container.id);
  const trayStopPending = trayAction === "stop" || trayAction === "restart";
  const trayStartPending = trayAction === "start";

  const stopPending = useMinPending(stopTransPending) || trayStopPending;
  const startPending = useMinPending(startTransPending) || trayStartPending;
  const pausePending = useMinPending(pauseTransPending || unpauseTransPending);

  function handleStop() {
    startStopTrans(async () => {
      addOptimistic("exited");
      try {
        await api.containers.stop(container.id);
        setConfirmedStatus("exited");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
        void queryClient.invalidateQueries({ queryKey: ["containers"] });
      }
    });
  }

  function handleStart() {
    startStartTrans(async () => {
      addOptimistic("running");
      try {
        await api.containers.start(container.id);
        setConfirmedStatus("running");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
        void queryClient.invalidateQueries({ queryKey: ["containers"] });
      }
    });
  }

  function handlePause() {
    startPauseTrans(async () => {
      addOptimistic("paused");
      try {
        await api.containers.pause(container.id);
        setConfirmedStatus("paused");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
        void queryClient.invalidateQueries({ queryKey: ["containers"] });
      }
    });
  }

  function handleUnpause() {
    startUnpauseTrans(async () => {
      addOptimistic("running");
      try {
        await api.containers.unpause(container.id);
        setConfirmedStatus("running");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
        void queryClient.invalidateQueries({ queryKey: ["containers"] });
      }
    });
  }

  function handleCopyId() {
    void navigator.clipboard.writeText(container.id).then(() =>
      toast.success("Container ID copied"),
    );
  }

  const remove = useMutation({
    mutationFn: () => api.containers.remove(container.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["containers"] });
      onRemoved();
    },
  });

  const goToDetail = (e: React.MouseEvent) => {
    e.stopPropagation();
    flushSync(() => setMenuOpen(false));
    void navigate({
      to: "/containers/$id",
      params: { id: container.id },
      search: { tab: "details" },
    });
  };

  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

  const isRemoving = remove.isPending;

  return (
    <>
    <Collapsible open={open} onOpenChange={!isRemoving ? setOpen : undefined}>
      <Card className={`py-0 transition-colors overflow-hidden ${isRemoving ? "opacity-60" : "hover:bg-accent"}`}>
        <CollapsibleTrigger asChild>
          <CardContent className="flex items-center gap-3 py-1.5 px-4 cursor-pointer select-none">
            {/* Drag handle — only visible when dragHandleProps are provided */}
            {!isRemoving && dragHandleProps && (
              <span
                {...dragHandleProps}
                className="cursor-grab touch-none text-muted-foreground/40 hover:text-muted-foreground/70 shrink-0"
                onClick={stopPropagation}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="9" cy="5" r="1" /><circle cx="15" cy="5" r="1" />
                  <circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" />
                  <circle cx="9" cy="19" r="1" /><circle cx="15" cy="19" r="1" />
                </svg>
              </span>
            )}

            {/* Checkbox */}
            {!isRemoving && <span onClick={stopPropagation}>
              <Checkbox
                checked={selected}
                onCheckedChange={onToggle}
                aria-label={`Select ${container.name}`}
              />
            </span>}

            {/* Status dot */}
            {isRemoving ? (
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-destructive animate-pulse" />
            ) : stopPending ? (
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-orange-400 animate-blink" />
            ) : startPending || unpauseTransPending ? (
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-400 animate-blink" />
            ) : pausePending ? (
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-yellow-400 animate-blink" />
            ) : (
              <StatusDot status={displayStatus} />
            )}

            {/* Name + short image */}
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <span className="font-medium truncate leading-tight">{container.name}</span>
              <span className="text-xs text-muted-foreground truncate">
                {container.image.split("/").pop()}
              </span>
            </div>

            {/* ID — click to copy */}
            <span
              className="hidden sm:flex items-center gap-1 font-mono text-xs text-muted-foreground shrink-0 w-28 cursor-pointer hover:text-foreground group overflow-visible"
              onClick={(e) => { e.stopPropagation(); handleCopyId(); }}
              title="Copy full container ID"
            >
              <span className="truncate">{container.id.slice(0, 12)}</span>
              <Copy className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
            </span>

            {/* Status badge */}
            {isRemoving ? (
              <Badge variant="outline" className="animate-pulse border-destructive text-destructive shrink-0 hidden md:flex">
                removing
              </Badge>
            ) : stopPending ? (
              <Badge variant="outline" className="animate-blink border-orange-500 text-orange-500 shrink-0 hidden md:flex">
                stopping
              </Badge>
            ) : startPending || unpauseTransPending ? (
              <Badge variant="outline" className="animate-blink border-blue-400 text-blue-400 shrink-0 hidden md:flex">
                starting
              </Badge>
            ) : pauseTransPending ? (
              <Badge variant="outline" className="animate-blink border-yellow-500 text-yellow-500 shrink-0 hidden md:flex">
                pausing
              </Badge>
            ) : (
              <Badge variant={statusVariant(displayStatus)} className="shrink-0 hidden md:flex">
                {displayStatus}
              </Badge>
            )}

            {/* Port badges */}
            {!isRemoving && container.ports.length > 0 && (
              <div className="flex items-center gap-1 shrink-0" onClick={stopPropagation}>
                {container.ports.slice(0, 3).map((p) => {
                  const hostPort = p.split(":")[0];
                  const port = parseInt(hostPort, 10);
                  const url =
                    port === 443 ? `https://localhost:${port}` : `http://localhost:${port}`;
                  const conflict = conflictingPorts?.has(port);
                  return (
                    <Badge
                      key={p}
                      variant="outline"
                      className={conflict
                        ? "font-mono text-xs px-1.5 py-0 cursor-pointer transition-colors bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30 dark:hover:bg-amber-500/20"
                        : "font-mono text-xs px-1.5 py-0 cursor-pointer transition-colors bg-sky-50 text-sky-700 border-sky-300 hover:bg-sky-100 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/30 dark:hover:bg-sky-500/20"}
                      onClick={() => void openUrl(url)}
                      title={conflict ? `Port conflict on ${port} — ${url}` : `Open ${url}`}
                    >
                      {hostPort}
                    </Badge>
                  );
                })}
                {container.ports.length > 3 && (
                  <span className="text-xs text-muted-foreground">
                    +{container.ports.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Actions */}
            <div
              className="flex items-center gap-1 shrink-0 pl-2 border-l border-border/60"
              onClick={stopPropagation}
            >
            {isRemoving ? null : (<>
              {stopPending ? (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-orange-500 animate-blink" disabled>
                  <Square className="h-3.5 w-3.5" />
                </Button>
              ) : startPending || unpauseTransPending ? (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-400 animate-blink" disabled>
                  <Play className="h-3.5 w-3.5" />
                </Button>
              ) : pauseTransPending ? (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-yellow-500 animate-blink" disabled>
                  <Pause className="h-3.5 w-3.5" />
                </Button>
              ) : isRunning ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-yellow-500 hover:text-yellow-600 hover:bg-yellow-500/10"
                    onClick={handlePause}
                    title="Pause"
                  >
                    <Pause className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    onClick={handleStop}
                    title="Stop"
                  >
                    <Square className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : isPaused ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-green-500 hover:text-green-600 hover:bg-green-500/10"
                  onClick={handleUnpause}
                  title="Unpause"
                >
                  <Play className="h-3.5 w-3.5" />
                </Button>
              ) : canStart ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-green-500 hover:text-green-600 hover:bg-green-500/10"
                  onClick={handleStart}
                  title="Start"
                >
                  <Play className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <span className="h-7 w-7" />
              )}

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={goToDetail}
                title="Open detail view"
              >
                <Info className="h-3.5 w-3.5" />
              </Button>

              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                  >
                    <EllipsisVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="data-[state=closed]:duration-0">
                  {isRunning && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePause(); }}>
                      <Pause className="h-3.5 w-3.5 mr-2" />
                      Pause
                    </DropdownMenuItem>
                  )}
                  {isPaused && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleUnpause(); }}>
                      <Play className="h-3.5 w-3.5 mr-2" />
                      Unpause
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCopyId(); }}>
                    <Copy className="h-3.5 w-3.5 mr-2" />
                    Copy ID
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={goToDetail}>
                    <Info className="h-3.5 w-3.5 mr-2" />
                    Full details
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      flushSync(() => setMenuOpen(false));
                      void navigate({
                        to: "/containers/$id",
                        params: { id: container.id },
                        search: { tab: "logs" },
                      });
                    }}
                  >
                    <ScrollText className="h-3.5 w-3.5 mr-2" />
                    Logs
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      flushSync(() => setMenuOpen(false));
                      void navigate({
                        to: "/containers/$id",
                        params: { id: container.id },
                        search: { tab: "insights" },
                      });
                    }}
                  >
                    <LayoutDashboard className="h-3.5 w-3.5 mr-2" />
                    Insights
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      flushSync(() => setMenuOpen(false));
                      void navigate({
                        to: "/containers/$id",
                        params: { id: container.id },
                        search: { tab: "terminal" },
                      });
                    }}
                  >
                    <Terminal className="h-3.5 w-3.5 mr-2" />
                    Open terminal
                  </DropdownMenuItem>
                  {!container.compose_project && moveToGroups && moveToGroups.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <ArrowRight className="h-3.5 w-3.5 mr-2" />
                          Move to
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {moveToGroups.map((g) => (
                            <DropdownMenuItem
                              key={g.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onMoveTo?.(g.id);
                              }}
                            >
                              {g.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    </>
                  )}
                  {!container.compose_project && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const ok = await confirm({
                            title: "Remove container?",
                            description: `"${container.name}" will be permanently removed. This cannot be undone.`,
                            confirmLabel: "Remove",
                          });
                          if (ok) remove.mutate();
                        }}
                        disabled={remove.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        {remove.isPending ? "Removing…" : "Remove"}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </>)}</div>

            {/* Expand chevron */}
            {!isRemoving && (
              <ChevronRight
                className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
                  open ? "rotate-90" : ""
                }`}
              />
            )}
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <ExpandedPanel container={container} snapshot={snapshot} conflictingPorts={conflictingPorts} />
        </CollapsibleContent>
      </Card>
    </Collapsible>
    {dialog}
    </>
  );
}
