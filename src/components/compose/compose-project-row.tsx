import { startTransition, useEffect, useState } from "react";
import { useConfirm } from "@/hooks/use-confirm";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ComposeOutput } from "@/components/compose/compose-output";
import { useComposeOutput } from "@/hooks/use-compose-output";
import { useComposePending } from "@/hooks/use-compose-pending";
import { api, type ComposeProject, type ComposeStatus } from "@/lib/api";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronRight,
  FilePen,
  Loader2,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";

// ─── Status helpers ────────────────────────────────────────────────────────

export function statusDot(status: ComposeStatus) {
  const classes: Record<ComposeStatus, string> = {
    running: "bg-green-500",
    partial: "bg-orange-400",
    stopped: "bg-muted-foreground/40",
    file_only: "bg-muted-foreground/40",
  };
  return <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${classes[status]}`} />;
}

export function statusLabel(status: ComposeStatus): string {
  return { running: "Running", partial: "Partial", stopped: "Stopped", file_only: "Stopped" }[
    status
  ];
}

// ─── Types ────────────────────────────────────────────────────────────────

export type ComposeOp = "up" | "down" | "restart" | "pull";

const OP_LABEL: Record<ComposeOp, string> = {
  up: "Starting",
  down: "Stopping",
  restart: "Restarting",
  pull: "Pulling",
};

// ─── Shared compose action buttons ────────────────────────────────────────
//
// Renders Up / Down / Restart buttons (context-sensitive on status) plus the
// op output sheet. Used in both the compose list row and the detail page header.

export function ComposeActions({ project }: { project: ComposeProject }) {
  const queryClient = useQueryClient();
  const [activeOp, setActiveOp] = useState<ComposeOp | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const wsUrl = activeOp
    ? (api.compose[`${activeOp}WsUrl`](project.name) as string)
    : null;
  const { lines, exitCode, running, clear } = useComposeOutput(wsUrl);

  useEffect(() => {
    if (running) return;
    if (exitCode !== null && exitCode !== 0) return;
    void queryClient.invalidateQueries({ queryKey: ["compose"] });
    void queryClient.invalidateQueries({ queryKey: ["containers"] });
    // Close sheet first so the slide-out animation plays, then unmount after it finishes.
    const t1 = setTimeout(() => startTransition(() => setSheetOpen(false)), 2000);
    const t2 = setTimeout(() => {
      startTransition(() => setActiveOp(null));
      clear();
    }, 2350);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [running, exitCode, queryClient, clear]);

  function runOp(op: ComposeOp, e: React.MouseEvent) {
    e.stopPropagation();
    clear();
    startTransition(() => {
      setActiveOp(op);
      setSheetOpen(true);
    });
  }

  function dismissOp() {
    startTransition(() => {
      setActiveOp(null);
      setSheetOpen(false);
    });
    clear();
  }

  const opActive = activeOp !== null;
  const opFailed = exitCode !== null && exitCode !== 0;

  // Tray-initiated op pending state — shows a spinner pill without a sheet.
  const trayPending = useComposePending(project.name);
  const showTraySpinner = trayPending !== null && !opActive;

  return (
    <>
      <div
        className="flex items-center gap-1 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {opActive ? (
          // UI-initiated op — clickable pill that re-opens the output sheet.
          <button
            className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-accent transition-colors cursor-pointer min-w-[130px]"
            onClick={(e) => { e.stopPropagation(); setSheetOpen(true); }}
          >
            {running ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground">{OP_LABEL[activeOp]}…</span>
              </>
            ) : opFailed ? (
              <>
                <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                <span className="text-xs text-destructive">{OP_LABEL[activeOp]} failed</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                <span className="text-xs text-green-500">{OP_LABEL[activeOp]} complete</span>
              </>
            )}
          </button>
        ) : showTraySpinner ? (
          // Tray-initiated op — status-only pill, no sheet to open.
          <div className="flex items-center gap-2 px-2 py-1 min-w-[130px]">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">{OP_LABEL[trayPending]}…</span>
          </div>
        ) : (
          <TooltipProvider>
            {(project.status === "running" || project.status === "partial") ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => runOp("down", e)}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Down</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => runOp("restart", e)}>
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Restart</TooltipContent>
                </Tooltip>
              </>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => runOp("up", e)}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Up</TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        )}
      </div>

      {activeOp && (
        <Sheet open={sheetOpen} onOpenChange={(o) => { if (!o) setSheetOpen(false); }}>
          <SheetContent className="sm:max-w-lg flex flex-col gap-0 p-0">
            <SheetHeader className="px-6 py-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                {running ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                ) : opFailed ? (
                  <XCircle className="h-4 w-4 text-destructive shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                )}
                <SheetTitle className="text-base">
                  {OP_LABEL[activeOp]} — {project.name}
                </SheetTitle>
              </div>
            </SheetHeader>
            <div className="flex-1 min-h-0 px-6 py-4 overflow-hidden flex flex-col gap-4">
              <ComposeOutput lines={lines} exitCode={exitCode} running={running} onClear={clear} />
              {opFailed && (
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={dismissOp}>Dismiss</Button>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

// ─── Project row ──────────────────────────────────────────────────────────

export function ProjectRow({
  project,
  onDelete,
  isDeleting = false,
}: {
  project: ComposeProject;
  onDelete: (name: string) => void;
  isDeleting?: boolean;
}) {
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirm();
  const [open, setOpen] = useState(false);
  const trayPending = useComposePending(project.name);

  return (
    <>
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="py-0 overflow-hidden transition-colors hover:bg-accent/50">
        <CollapsibleTrigger asChild>
          <CardContent className="flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none">
            {trayPending !== null
              ? <span className="inline-block h-2 w-2 rounded-full shrink-0 bg-orange-400 animate-pulse" />
              : statusDot(project.status)}
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{project.name}</span>
                {!project.file_managed && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 shrink-0">
                    label-detected
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs px-1.5 py-0 shrink-0">
                  {statusLabel(project.status)}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {project.services.length} service{project.services.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Shared action buttons */}
            <ComposeActions project={project} />

            {/* List-only buttons: navigate to detail, delete */}
            <div
              className="flex items-center gap-1 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        void navigate({ to: "/compose/$name", params: { name: project.name }, search: { tab: "services", autoUp: false } });
                      }}
                    >
                      <FilePen className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      disabled={isDeleting}
                      onClick={async (e) => {
                        e.stopPropagation();
                        const ok = await confirm({
                          title: "Delete project?",
                          description: project.file_managed
                            ? `"${project.name}" and its compose file will be permanently deleted.`
                            : `All containers for "${project.name}" will be stopped and removed.`,
                          confirmLabel: "Delete",
                        });
                        if (ok) onDelete(project.name);
                      }}
                    >
                      <Trash2 className={`h-3.5 w-3.5 ${isDeleting ? "animate-pulse" : ""}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isDeleting ? "Deleting…" : "Delete"}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <ChevronRight
              className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
            />
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent className="collapsible-animated">
          {project.services.length > 0 && (
            <div className="px-4 pb-2 border-t border-border/50">
              <div className="flex flex-col gap-1 pt-2">
                {project.services.map((svc) => (
                  <div key={svc.name} className="flex items-center gap-3 text-sm py-1">
                    <span
                      className={`h-1.5 w-1.5 rounded-full shrink-0 ${svc.status === "running" ? "bg-green-500" : "bg-muted-foreground/40"}`}
                    />
                    <span className="font-medium w-40 truncate shrink-0">{svc.name}</span>
                    <span className="text-xs text-muted-foreground truncate flex-1">
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
                  </div>
                ))}
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Card>
    </Collapsible>

    {dialog}
    </>
  );
}
