import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

/** Key-value row used throughout the details panel. */
function DF({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-4 px-3 py-2 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="text-sm break-all">{children}</span>
    </div>
  );
}

export function DetailsPanel({ containerId }: { containerId: string }) {
  const { data: inspect, isLoading, error } = useQuery({
    queryKey: ["container-inspect", containerId],
    queryFn: () => api.containers.inspect(containerId),
    staleTime: 15_000,
    retry: 1,
  });

  const [envRevealed, setEnvRevealed] = useState(false);
  const [labelsExpanded, setLabelsExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 mt-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error || !inspect) {
    return (
      <p className="text-destructive text-sm mt-3">Failed to load container details.</p>
    );
  }

  const command = [...inspect.entrypoint, ...inspect.command];
  const envPairs = inspect.env.map((e) => {
    const eq = e.indexOf("=");
    return eq === -1 ? { key: e, value: "" } : { key: e.slice(0, eq), value: e.slice(eq + 1) };
  });
  const labelEntries = Object.entries(inspect.labels);
  const visibleLabels = labelsExpanded ? labelEntries : labelEntries.slice(0, 5);

  return (
    <div className="flex flex-col gap-6 max-w-3xl mt-3">

      {/* ── Overview ── */}
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overview</h3>
        <div className="rounded-lg border">
          <DF label="ID"><code className="font-mono text-xs">{inspect.id.slice(0, 12)}</code></DF>
          <DF label="Image">{inspect.image}</DF>
          {inspect.image_id && (
            <DF label="Image ID">
              <code className="font-mono text-xs">
                {inspect.image_id.replace("sha256:", "").slice(0, 20)}
              </code>
            </DF>
          )}
          {inspect.created && (
            <DF label="Created">
              {formatDistanceToNow(new Date(inspect.created), { addSuffix: true })}
            </DF>
          )}
          {command.length > 0 && (
            <DF label="Command">
              <code className="font-mono text-xs break-all">{command.join(" ")}</code>
            </DF>
          )}
          {inspect.working_dir && (
            <DF label="Working Dir">
              <code className="font-mono text-xs">{inspect.working_dir}</code>
            </DF>
          )}
          {inspect.hostname && <DF label="Hostname">{inspect.hostname}</DF>}
          <DF label="Restart Policy">{inspect.restart_policy}</DF>
          {inspect.memory_limit != null && (
            <DF label="Memory Limit">{formatBytes(inspect.memory_limit)}</DF>
          )}
          {inspect.pid != null && inspect.pid > 0 && (
            <DF label="PID">{inspect.pid}</DF>
          )}
          {inspect.exit_code != null && (
            <DF label="Exit Code">
              <span className={inspect.exit_code === 0 ? "text-green-500" : "text-destructive"}>
                {inspect.exit_code}
              </span>
            </DF>
          )}
        </div>
      </section>

      {/* ── Networks ── */}
      {inspect.networks.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Networks</h3>
          <div className="rounded-lg border divide-y divide-border/50">
            {inspect.networks.map((net) => (
              <div key={net.name} className="px-3 py-2.5 flex flex-col gap-1.5">
                <p className="text-sm font-medium">{net.name}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 pl-2">
                  {net.ip && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">IP</p>
                      <code className="font-mono text-xs">
                        {net.ip}{net.prefix_len != null ? `/${net.prefix_len}` : ""}
                      </code>
                    </div>
                  )}
                  {net.gateway && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Gateway</p>
                      <code className="font-mono text-xs">{net.gateway}</code>
                    </div>
                  )}
                  {net.mac && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">MAC</p>
                      <code className="font-mono text-xs">{net.mac}</code>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Ports ── */}
      {inspect.ports.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ports</h3>
          <div className="flex flex-wrap gap-1.5">
            {inspect.ports.map((p, i) => (
              <Badge key={i} variant="outline" className="font-mono text-xs">
                {p.host_port != null
                  ? `${p.host_ip && p.host_ip !== "0.0.0.0" ? p.host_ip + ":" : ""}${p.host_port} → ${p.container_port}/${p.proto}`
                  : `${p.container_port}/${p.proto}`}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* ── Mounts ── */}
      {inspect.mounts.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mounts</h3>
          <div className="rounded-lg border divide-y divide-border/50">
            {inspect.mounts.map((m, i) => (
              <div key={i} className="flex items-start gap-2.5 px-3 py-2.5">
                <Badge variant="secondary" className="text-[10px] h-5 shrink-0 mt-0.5">
                  {m.mount_type}
                </Badge>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-1.5 font-mono text-xs">
                    <span
                      className="text-muted-foreground truncate max-w-[200px]"
                      title={m.source ?? undefined}
                    >
                      {m.source ?? "—"}
                    </span>
                    <span className="text-muted-foreground/40 shrink-0">→</span>
                    <span className="truncate max-w-[200px]" title={m.destination}>
                      {m.destination}
                    </span>
                  </div>
                  {(m.name ?? !m.rw) && (
                    <div className="flex items-center gap-1.5">
                      {m.name && (
                        <span className="text-xs text-muted-foreground">{m.name}</span>
                      )}
                      {!m.rw && (
                        <Badge variant="outline" className="text-[10px] h-4 py-0 px-1.5">
                          read-only
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Environment ── */}
      {envPairs.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Environment ({envPairs.length})
            </h3>
            <button
              onClick={() => setEnvRevealed((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {envRevealed ? "Hide values" : "Reveal values"}
            </button>
          </div>
          <div className="rounded-lg border divide-y divide-border/40">
            {envPairs.map(({ key, value }) => (
              <div key={key} className="flex items-baseline px-3 py-1.5 gap-0.5 font-mono text-xs">
                <span className="text-muted-foreground shrink-0">{key}</span>
                {value && (
                  <>
                    <span className="text-muted-foreground/40 mx-0.5">=</span>
                    <span className={`break-all ${envRevealed ? "" : "text-muted-foreground/25 select-none"}`}>
                      {envRevealed ? value : "•".repeat(Math.min(value.length, 16))}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Labels ── */}
      {labelEntries.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Labels ({labelEntries.length})
          </h3>
          <div className="rounded-lg border divide-y divide-border/40">
            {visibleLabels.map(([k, v]) => (
              <div key={k} className="px-3 py-1.5 font-mono text-xs">
                <span className="text-muted-foreground">{k}</span>
                {v && (
                  <>
                    <span className="text-muted-foreground/40 mx-0.5">=</span>
                    <span className="break-all">{v}</span>
                  </>
                )}
              </div>
            ))}
          </div>
          {labelEntries.length > 5 && (
            <button
              onClick={() => setLabelsExpanded((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors self-start"
            >
              {labelsExpanded ? "Show less" : `Show ${labelEntries.length - 5} more`}
            </button>
          )}
        </section>
      )}

    </div>
  );
}
