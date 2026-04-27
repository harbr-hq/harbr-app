import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";

export function StatusBar() {
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: api.health.get,
    refetchInterval: 5_000,
    staleTime: 4_000,
  });

  const { data: info } = useQuery({
    queryKey: ["info"],
    queryFn: api.info.get,
    staleTime: Infinity,
  });

  const connected = health?.podman_connected ?? false;
  const conflicts = health?.port_conflict_count ?? 0;

  return (
    <div className="h-7 shrink-0 border-t bg-muted/20 flex items-center px-4 gap-4 text-xs text-muted-foreground select-none">
      {/* Podman connection */}
      <div className="flex items-center gap-1.5">
        <span
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${connected ? "bg-green-500" : "bg-red-500"}`}
        />
        <span>{connected ? "Podman connected" : "Podman offline"}</span>
      </div>

      <div className="flex-1" />

      {/* Port conflicts — only shown when relevant */}
      {conflicts > 0 && (
        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3" />
          {conflicts} port conflict{conflicts !== 1 ? "s" : ""}
        </span>
      )}

      {/* Running container count */}
      {connected && <span>{health?.running_count ?? 0} running</span>}

      {/* App version */}
      {info?.app_version && (
        <>
          <span className="opacity-30">·</span>
          <span>v{info.app_version}</span>
        </>
      )}
    </div>
  );
}
