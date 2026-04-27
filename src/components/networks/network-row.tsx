import { useState } from "react";
import { useConfirm } from "@/hooks/use-confirm";
import { formatDistanceToNow } from "date-fns";
import { type Network, type NetworkMember } from "@/lib/api";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { ChevronRight, EllipsisVertical, Trash2 } from "lucide-react";

// Built-in networks that should not be removed.
export const PROTECTED = new Set(["bridge", "host", "none", "podman"]);

// ─── Helpers ──────────────────────────────────────────────────────────────

export function driverColour(driver: string): string {
  switch (driver) {
    case "bridge":  return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "host":    return "bg-green-500/15 text-green-400 border-green-500/30";
    case "none":    return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
    case "overlay": return "bg-purple-500/15 text-purple-400 border-purple-500/30";
    default:        return "bg-accent text-muted-foreground border-border";
  }
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

function ContainerTable({ members }: { members: NetworkMember[] }) {
  if (members.length === 0) {
    return <span className="text-xs text-muted-foreground">No containers connected</span>;
  }
  return (
    <div className="rounded-md border border-border/50 overflow-hidden divide-y divide-border/30">
      {members.map((m) => (
        <div key={m.id} className="flex items-center gap-3 px-3 py-1.5">
          <span className="font-mono text-xs flex-1 truncate">{m.name || m.id.slice(0, 12)}</span>
          {m.ipv4_address && (
            <span className="font-mono text-xs text-muted-foreground shrink-0">{m.ipv4_address}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function InspectPanel({ network }: { network: Network }) {
  const hasLabels = Object.keys(network.labels).length > 0;

  return (
    <div className="px-4 py-3 border-t border-border/50 text-sm space-y-3">
      <div className="grid grid-cols-2 gap-x-8 gap-y-3">
        <InspectField label="ID">
          <span className="font-mono text-xs text-muted-foreground">{network.id.slice(0, 12)}</span>
        </InspectField>
        <InspectField label="Scope">
          <span className="font-mono text-xs">{network.scope}</span>
        </InspectField>
        {network.subnet && (
          <InspectField label="Subnet">
            <span className="font-mono text-xs">{network.subnet}</span>
          </InspectField>
        )}
        {network.gateway && (
          <InspectField label="Gateway">
            <span className="font-mono text-xs">{network.gateway}</span>
          </InspectField>
        )}
        {network.internal && (
          <InspectField label="Internal">
            <Badge variant="outline" className="text-xs px-1.5 py-0">yes</Badge>
          </InspectField>
        )}
      </div>

      {hasLabels && (
        <>
          <Separator />
          <InspectField label="Labels">
            <div className="space-y-0.5 mt-1">
              {Object.entries(network.labels).map(([k, v]) => (
                <p key={k} className="font-mono text-xs text-muted-foreground break-all">
                  <span className="text-foreground">{k}</span>={v}
                </p>
              ))}
            </div>
          </InspectField>
        </>
      )}

      <Separator />
      <InspectField label="Connected containers">
        <div className="mt-1">
          <ContainerTable members={network.containers} />
        </div>
      </InspectField>
    </div>
  );
}

// ─── Network row ──────────────────────────────────────────────────────────

export function NetworkRow({
  network,
  onRemove,
}: {
  network: Network;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { confirm, dialog } = useConfirm();
  const isProtected = PROTECTED.has(network.name);
  const inUse = network.container_count > 0;
  const canRemove = !isProtected && !inUse;

  const age = network.created
    ? formatDistanceToNow(new Date(network.created), { addSuffix: true })
    : "—";

  return (
    <>
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="py-0 overflow-hidden transition-colors hover:bg-accent/50">
        <CollapsibleTrigger asChild>
          <CardContent className="flex items-center gap-4 px-4 py-2.5 cursor-pointer select-none">
            {/* Name + driver badge */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span className="font-medium font-mono text-sm truncate leading-tight">
                {network.name}
              </span>
              <Badge
                variant="outline"
                className={`font-mono text-xs px-1.5 py-0 shrink-0 border ${driverColour(network.driver)}`}
              >
                {network.driver}
              </Badge>
              {isProtected && (
                <Badge variant="outline" className="font-mono text-xs px-1.5 py-0 shrink-0 text-muted-foreground">
                  built-in
                </Badge>
              )}
            </div>

            {/* Stats */}
            <div className="hidden sm:flex items-center gap-6 shrink-0 text-sm">
              {network.subnet && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Subnet</p>
                  <span className="font-mono text-xs tabular-nums">{network.subnet}</span>
                </div>
              )}
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Created</p>
                <span className="text-xs">{age}</span>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Containers</p>
                <span className="tabular-nums">{network.container_count}</span>
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
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    disabled={!canRemove}
                    onClick={async (e) => {
                      e.stopPropagation();
                      const ok = await confirm({
                        title: "Remove network?",
                        description: `"${network.name}" will be permanently removed.`,
                        confirmLabel: "Remove",
                      });
                      if (ok) onRemove(network.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Remove
                    {isProtected && (
                      <span className="ml-auto text-xs text-muted-foreground font-normal">built-in</span>
                    )}
                    {!isProtected && inUse && (
                      <span className="ml-auto text-xs text-muted-foreground font-normal">in use</span>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <ChevronRight
              className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
            />
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <InspectPanel network={network} />
        </CollapsibleContent>
      </Card>
    </Collapsible>
    {dialog}
    </>
  );
}
