import { useQuery } from "@tanstack/react-query";
import { api, type VolumeFileEntry } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, EllipsisVertical, File, Folder } from "lucide-react";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";

export function FileBrowser({
  volumeName,
  mountpoint,
  enabled,
}: {
  volumeName: string;
  mountpoint: string;
  enabled: boolean;
}) {
  const [path, setPath] = useState("/");

  const { data: entries, isLoading, error } = useQuery({
    queryKey: ["volume-files", volumeName, path],
    queryFn: () => api.volumes.browse(volumeName, path),
    enabled,
    staleTime: 15_000,
  });

  const parts = path.split("/").filter(Boolean);

  function navigateUp() {
    const parent = "/" + parts.slice(0, -1).join("/");
    setPath(parent || "/");
  }

  return (
    <div className="space-y-2">
      {/* Breadcrumb */}
      <div className="flex items-center gap-0.5 font-mono text-xs overflow-x-auto">
        <button
          onClick={() => setPath("/")}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          /
        </button>
        {parts.map((part, i) => {
          const target = "/" + parts.slice(0, i + 1).join("/");
          const isLast = i === parts.length - 1;
          return (
            <span key={target} className="flex items-center gap-0.5 shrink-0">
              <span className="text-muted-foreground">/</span>
              <button
                onClick={() => setPath(target)}
                className={isLast ? "text-foreground" : "text-muted-foreground hover:text-foreground"}
              >
                {part}
              </button>
            </span>
          );
        })}
      </div>

      {/* Listing */}
      {isLoading && <Skeleton className="h-20 w-full" />}
      {error && (
        <p className="text-xs text-destructive">{error instanceof Error ? error.message : "Failed to read directory"}</p>
      )}
      {entries && (
        <div className="rounded-md border border-border/50 overflow-hidden divide-y divide-border/30">
          {path !== "/" && (
            <button
              onClick={navigateUp}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent/50 text-left"
            >
              <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-mono text-xs text-muted-foreground">..</span>
            </button>
          )}
          {entries.length === 0 && path === "/" && (
            <p className="px-3 py-3 text-xs text-muted-foreground">Empty volume</p>
          )}
          {entries.map((entry: VolumeFileEntry) => (
            <div
              key={entry.path}
              onClick={() => entry.is_dir && setPath(entry.path)}
              className={`group flex items-center gap-2 px-3 py-1.5 ${entry.is_dir ? "cursor-pointer hover:bg-accent/50" : "hover:bg-accent/30"}`}
            >
              {entry.is_dir ? (
                <Folder className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              ) : (
                <File className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              <span className={`font-mono text-xs truncate flex-1 ${entry.is_dir ? "text-blue-400" : ""}`}>
                {entry.name}
              </span>
              {!entry.is_dir && (
                <>
                  <span className="font-mono text-xs text-muted-foreground shrink-0 tabular-nums">
                    {formatBytes(entry.size)}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:opacity-100">
                        <EllipsisVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="data-[state=closed]:duration-0">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          void invoke("open_file_path", { path: mountpoint + entry.path }).catch((e) =>
                            toast.error(`Could not open: ${e instanceof Error ? e.message : String(e)}`),
                          );
                        }}
                      >
                        <File className="h-3.5 w-3.5 mr-2" />
                        Open
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const dest = await save({ defaultPath: entry.name });
                            if (!dest) return;
                            await invoke("save_file_as", { source: mountpoint + entry.path, destination: dest });
                            toast.success("File saved");
                          } catch (err) {
                            toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
                          }
                        }}
                      >
                        <Copy className="h-3.5 w-3.5 mr-2" />
                        Save as…
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
