import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useConfirm } from "@/hooks/use-confirm";
import { formatDistanceToNow } from "date-fns";
import { api, type Volume, type VolumeContainer } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, Copy, EllipsisVertical, Trash2 } from "lucide-react";
import { FileBrowser } from "@/components/volumes/file-browser";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────

function containerStatusColour(status: string): string {
  if (status === "running") return "text-green-500";
  if (status === "exited" || status === "dead") return "text-red-500";
  return "text-muted-foreground";
}

// ─── Inspect sub-components ───────────────────────────────────────────────

function InspectField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      {children}
    </div>
  );
}

function ContainerUsageList({ containers }: { containers: VolumeContainer[] | undefined }) {
  if (!containers) {
    return <Skeleton className="h-6 w-48" />;
  }
  if (containers.length === 0) {
    return <span className="text-xs text-muted-foreground">None</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {containers.map((c) => (
        <div
          key={c.id}
          className="flex items-center gap-1.5 rounded border border-border/60 px-2 py-0.5"
        >
          <span className={`text-[10px] font-mono ${containerStatusColour(c.status)}`}>●</span>
          <span className="font-mono text-xs">{c.name || c.id.slice(0, 12)}</span>
        </div>
      ))}
    </div>
  );
}

function InspectPanel({
  volume,
  containers,
  open,
}: {
  volume: Volume;
  containers: VolumeContainer[] | undefined;
  open: boolean;
}) {
  const hasOptions = Object.keys(volume.options).length > 0;
  const hasLabels = Object.keys(volume.labels).length > 0;

  return (
    <div className="px-4 py-3 border-t border-border/50 text-sm">
      <div className="grid grid-cols-2 gap-x-8 gap-y-3">
        <InspectField label="Mount point">
          <span className="font-mono text-xs break-all">{volume.mountpoint}</span>
        </InspectField>
        {volume.scope && (
          <InspectField label="Scope">
            <Badge variant="outline" className="font-mono text-xs px-1.5 py-0">
              {volume.scope.toLowerCase()}
            </Badge>
          </InspectField>
        )}
      </div>

      {hasOptions && (
        <>
          <Separator className="my-3" />
          <InspectField label="Driver options">
            <div className="mt-1 space-y-0.5">
              {Object.entries(volume.options).map(([k, v]) => (
                <p key={k} className="font-mono text-xs text-muted-foreground">
                  <span className="text-foreground">{k}</span>={v}
                </p>
              ))}
            </div>
          </InspectField>
        </>
      )}

      {hasLabels && (
        <>
          <Separator className="my-3" />
          <InspectField label="Labels">
            <div className="mt-1 space-y-0.5">
              {Object.entries(volume.labels).map(([k, v]) => (
                <p key={k} className="font-mono text-xs text-muted-foreground break-all">
                  <span className="text-foreground">{k}</span>={v}
                </p>
              ))}
            </div>
          </InspectField>
        </>
      )}

      <Separator className="my-3" />
      <InspectField label="Used by">
        <div className="mt-1">
          <ContainerUsageList containers={containers} />
        </div>
      </InspectField>

      <Separator className="my-3" />
      <InspectField label="Files">
        <div className="mt-1">
          <FileBrowser volumeName={volume.name} mountpoint={volume.mountpoint} enabled={open} />
        </div>
      </InspectField>
    </div>
  );
}

// ─── Volume row ───────────────────────────────────────────────────────────

export function VolumeRow({
  volume,
  onRemove,
}: {
  volume: Volume;
  onRemove: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { confirm, dialog } = useConfirm();

  const { data: containers } = useQuery({
    queryKey: ["volume-containers", volume.name],
    queryFn: () => api.volumes.containers(volume.name),
    enabled: open,
    staleTime: 30_000,
  });

  const inUse = volume.ref_count > 0;
  const age = volume.created_at
    ? formatDistanceToNow(new Date(volume.created_at), { addSuffix: true })
    : "—";
  const refCount = volume.ref_count === -1 ? "—" : String(volume.ref_count);

  const copyName = (e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(volume.name);
    toast.success("Name copied");
  };

  return (
    <>
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="py-0 overflow-hidden transition-colors hover:bg-accent/50">
        <CollapsibleTrigger asChild>
          <CardContent className="flex items-center gap-4 px-4 py-2.5 cursor-pointer select-none">
            {/* Name + driver */}
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <span className="font-medium font-mono text-sm truncate leading-tight">
                {volume.name}
              </span>
              <span className="text-xs text-muted-foreground">{volume.driver}</span>
            </div>

            {/* Stats */}
            <div className="hidden sm:flex items-center gap-6 shrink-0 text-sm">
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Size</p>
                <span className="tabular-nums">{formatBytes(volume.size)}</span>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Created</p>
                <span>{age}</span>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Containers</p>
                <span className="tabular-nums">{refCount}</span>
              </div>
            </div>

            {/* Actions */}
            <div
              className="flex items-center gap-1 shrink-0 pl-2 border-l border-border/60"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                    <EllipsisVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="data-[state=closed]:duration-0">
                  <DropdownMenuItem onClick={copyName}>
                    <Copy className="h-3.5 w-3.5 mr-2" />
                    Copy name
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    disabled={inUse}
                    onClick={async (e) => {
                      e.stopPropagation();
                      const ok = await confirm({
                        title: "Remove volume?",
                        description: `"${volume.name}" will be permanently removed. All data stored in this volume will be lost.`,
                        confirmLabel: "Remove",
                      });
                      if (ok) onRemove(volume.name);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Remove
                    {inUse && (
                      <span className="ml-auto text-xs text-muted-foreground font-normal">
                        in use
                      </span>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Expand chevron */}
            <ChevronRight
              className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
            />
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <InspectPanel volume={volume} containers={containers} open={open} />
        </CollapsibleContent>
      </Card>
    </Collapsible>
    {dialog}
    </>
  );
}
