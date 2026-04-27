import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useConfirm } from "@/hooks/use-confirm";
import { formatDistanceToNow } from "date-fns";
import { api, type Image, type ImageDetails } from "@/lib/api";
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
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────

export function shortId(id: string): string {
  const stripped = id.startsWith("sha256:") ? id.slice(7) : id;
  return stripped.slice(0, 12);
}

export function primaryTag(repoTags: string[]): string {
  return repoTags[0] ?? "<untagged>";
}

// ─── Inspect panel ────────────────────────────────────────────────────────

function InspectField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      {children}
    </div>
  );
}

function InspectPanel({ details }: { details: ImageDetails | undefined }) {
  if (!details) {
    return (
      <div className="px-4 py-3 border-t border-border/50 grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  const platform = [details.os, details.architecture].filter(Boolean).join("/") || "—";

  return (
    <div className="px-4 py-3 border-t border-border/50 text-sm">
      <div className="grid grid-cols-2 gap-x-8 gap-y-3">
        <InspectField label="Platform">
          <span className="font-mono text-xs">{platform}</span>
        </InspectField>

        {details.docker_version && (
          <InspectField label="Build tool">
            <span className="font-mono text-xs">{details.docker_version}</span>
          </InspectField>
        )}

        {details.entrypoint.length > 0 && (
          <InspectField label="Entrypoint">
            <span className="font-mono text-xs break-all">{details.entrypoint.join(" ")}</span>
          </InspectField>
        )}

        {details.cmd.length > 0 && (
          <InspectField label="Command">
            <span className="font-mono text-xs break-all">{details.cmd.join(" ")}</span>
          </InspectField>
        )}

        {details.exposed_ports.length > 0 && (
          <InspectField label="Exposed ports">
            <div className="flex flex-wrap gap-1">
              {details.exposed_ports.map((p) => (
                <Badge key={p} variant="outline" className="font-mono text-xs px-1.5 py-0">
                  {p}
                </Badge>
              ))}
            </div>
          </InspectField>
        )}

        {details.author && (
          <InspectField label="Author">
            <span className="text-xs">{details.author}</span>
          </InspectField>
        )}
      </div>

      {details.env.length > 0 && (
        <>
          <Separator className="my-3" />
          <InspectField label="Environment">
            <div className="mt-1 space-y-0.5 max-h-32 overflow-y-auto">
              {details.env.map((e) => (
                <p key={e} className="font-mono text-xs text-muted-foreground break-all">{e}</p>
              ))}
            </div>
          </InspectField>
        </>
      )}

      {Object.keys(details.labels).length > 0 && (
        <>
          <Separator className="my-3" />
          <InspectField label="Labels">
            <div className="mt-1 space-y-0.5 max-h-24 overflow-y-auto">
              {Object.entries(details.labels).map(([k, v]) => (
                <p key={k} className="font-mono text-xs text-muted-foreground break-all">
                  <span className="text-foreground">{k}</span>={v}
                </p>
              ))}
            </div>
          </InspectField>
        </>
      )}
    </div>
  );
}

// ─── Image row ────────────────────────────────────────────────────────────

export function ImageRow({
  image,
  onRemove,
}: {
  image: Image;
  onRemove: (id: string, force: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const { confirm, dialog } = useConfirm();

  const { data: details } = useQuery({
    queryKey: ["image-inspect", image.id],
    queryFn: () => api.images.inspect(image.id),
    enabled: open,
    staleTime: 60_000,
  });

  const inUse = image.containers > 0;

  const primary = primaryTag(image.repo_tags);
  const extraTags = image.repo_tags.slice(1);
  const age = image.created
    ? formatDistanceToNow(new Date(image.created * 1000), { addSuffix: true })
    : "—";
  const containerCount = image.containers === -1 ? "—" : String(image.containers);

  const copyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(shortId(image.id));
    toast.success("ID copied");
  };

  return (
    <>
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="py-0 overflow-hidden transition-colors hover:bg-accent/50">
        <CollapsibleTrigger asChild>
          <CardContent className="flex items-center gap-4 px-4 py-2.5 cursor-pointer select-none">
            {/* Name + extra tags */}
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`font-medium truncate leading-tight ${primary === "<untagged>" ? "text-muted-foreground italic" : ""}`}
                >
                  {primary}
                </span>
                {extraTags.map((tag) => (
                  <Badge key={tag} variant="outline" className="font-mono text-xs px-1.5 py-0 shrink-0">
                    {tag}
                  </Badge>
                ))}
              </div>
              <span className="font-mono text-xs text-muted-foreground">{shortId(image.id)}</span>
            </div>

            {/* Stats */}
            <div className="hidden sm:flex items-center gap-6 shrink-0 text-sm">
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Size</p>
                <span className="tabular-nums">{formatBytes(image.size)}</span>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Created</p>
                <span>{age}</span>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Containers</p>
                <span className="tabular-nums">{containerCount}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0 pl-2 border-l border-border/60" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                    <EllipsisVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="data-[state=closed]:duration-0">
                  <DropdownMenuItem onClick={copyId}>
                    <Copy className="h-3.5 w-3.5 mr-2" />
                    Copy ID
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    disabled={inUse}
                    onClick={async (e) => {
                      e.stopPropagation();
                      const ok = await confirm({
                        title: "Remove image?",
                        description: `"${image.repo_tags[0] ?? image.id.slice(0, 12)}" will be removed.`,
                        confirmLabel: "Remove",
                      });
                      if (ok) onRemove(image.id, false);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Remove
                    {inUse && (
                      <span className="ml-auto text-xs text-muted-foreground font-normal">in use</span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const ok = await confirm({
                        title: "Force remove image?",
                        description: `"${image.repo_tags[0] ?? image.id.slice(0, 12)}" will be forcefully removed even if containers are using it. This may break running containers.`,
                        confirmLabel: "Force remove",
                      });
                      if (ok) onRemove(image.id, true);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Force remove
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
          <InspectPanel details={details} />
        </CollapsibleContent>
      </Card>
    </Collapsible>
    {dialog}
    </>
  );
}
