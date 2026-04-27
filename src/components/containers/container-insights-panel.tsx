import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TextInput } from "@/components/ui/text-input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import { useContainerStats } from "@/hooks/use-container-stats";

const cpuChartConfig = {
  cpuPercent: { label: "CPU %", color: "var(--chart-orange)" },
} satisfies ChartConfig;

const memChartConfig = {
  memoryPercent: { label: "Memory %", color: "var(--chart-purple)" },
} satisfies ChartConfig;

export function InsightsPanel({
  statsData,
  isRunning,
  containerId,
  isCompose = false,
}: {
  statsData: ReturnType<typeof useContainerStats>;
  isRunning: boolean;
  containerId: string;
  isCompose?: boolean;
}) {
  const queryClient = useQueryClient();
  const { history, current, connected, wsReady } = statsData;

  const { data: info } = useQuery({
    queryKey: ["app-info"],
    queryFn: api.info.get,
    staleTime: Infinity,
  });

  const podmanMajor = parseInt(info?.podman_version?.split(".")[0] ?? "0", 10);
  const supportsRuntimeRestart = podmanMajor >= 5;

  // Settings — seeded once from server, user owns local state after that.
  const { data: settings } = useQuery({
    queryKey: ["container-settings", containerId],
    queryFn: () => api.settings.get(containerId),
  });

  const { data: inspect } = useQuery({
    queryKey: ["container-inspect", containerId],
    queryFn: () => api.containers.inspect(containerId),
  });

  const [persistentLogs, setPersistentLogs] = useState(false);
  const [retentionType, setRetentionType] = useState<"size" | "days">("size");
  const [retentionMb, setRetentionMb] = useState(250);
  const [retentionDays, setRetentionDays] = useState(30);
  const seededRef = useRef(false);

  useEffect(() => {
    if (settings && !seededRef.current) {
      seededRef.current = true;
      setPersistentLogs(settings.persistent_logs);
      setRetentionType(settings.retention_type);
      setRetentionMb(settings.retention_mb);
      setRetentionDays(settings.retention_days ?? 30);
    }
  }, [settings]);

  const [restartPolicy, setRestartPolicy] = useState("no");
  const restartSeededRef = useRef(false);

  useEffect(() => {
    if (inspect && !restartSeededRef.current) {
      restartSeededRef.current = true;
      setRestartPolicy(inspect.restart_policy);
    }
  }, [inspect]);

  const restartPolicyMutation = useMutation({
    mutationFn: () => api.containers.setRestartPolicy(containerId, restartPolicy),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["container-inspect", containerId] });
      toast.success("Restart policy updated");
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to update restart policy: ${msg}`);
    },
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      api.settings.update(containerId, {
        persistent_logs: persistentLogs,
        retention_type: retentionType,
        retention_mb: retentionType === "size" ? retentionMb : undefined,
        retention_days: retentionType === "days" ? retentionDays : null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["container-settings", containerId] });
      toast.success("Settings saved");
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Save failed: ${msg}`);
    },
  });

  return (
    <div className="flex flex-col gap-6">

      {/* ── Live stats ── */}
      {isRunning ? (
        !wsReady ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
              {connected ? "Fetching live data…" : "Connecting…"}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[0, 1].map((i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-32 w-full rounded-md" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-muted"}`} />
              {connected ? "live" : "connecting…"}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    CPU{" "}
                    <span className="text-muted-foreground font-normal">
                      {current ? `${current.cpuPercent.toFixed(1)}%` : "—"}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={cpuChartConfig} className="h-32 w-full">
                    <AreaChart data={history}>
                      <XAxis dataKey="timestamp" hide />
                      <YAxis domain={[0, 100]} hide />
                      <ChartTooltip content={<ChartTooltipContent formatter={(v) => `${Number(v).toFixed(1)}%`} />} />
                      <Area type="monotone" dataKey="cpuPercent" stroke="var(--color-cpuPercent)" fill="var(--color-cpuPercent)" fillOpacity={0.2} isAnimationActive={false} />
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Memory{" "}
                    <span className="text-muted-foreground font-normal">
                      {current ? `${formatBytes(current.memoryUsage)} / ${formatBytes(current.memoryLimit)}` : "—"}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={memChartConfig} className="h-32 w-full">
                    <AreaChart data={history}>
                      <XAxis dataKey="timestamp" hide />
                      <YAxis domain={[0, 100]} hide />
                      <ChartTooltip content={<ChartTooltipContent formatter={(v) => `${Number(v).toFixed(1)}%`} />} />
                      <Area type="monotone" dataKey="memoryPercent" stroke="var(--color-memoryPercent)" fill="var(--color-memoryPercent)" fillOpacity={0.2} isAnimationActive={false} />
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        )
      ) : (
        <p className="text-muted-foreground">Container is not running — stats unavailable.</p>
      )}

      <Separator />

      {/* ── Persistence settings ── */}
      <div className="flex flex-col gap-4 max-w-md">
        <div>
          <h3 className="text-sm font-semibold">Persistence</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Store logs to disk — enables cross-container search.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Enable persistent logging</p>
            <p className="text-xs text-muted-foreground">Logs will be written to the local database.</p>
          </div>
          <Switch checked={persistentLogs} onCheckedChange={setPersistentLogs} />
        </div>

        {persistentLogs && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <p className="text-sm text-muted-foreground">Retain by</p>
              <div className="flex items-center gap-1 rounded-md border p-0.5 w-fit">
                <Button
                  size="sm"
                  variant={retentionType === "size" ? "default" : "ghost"}
                  className="h-7 px-3"
                  onClick={() => setRetentionType("size")}
                >
                  Size
                </Button>
                <Button
                  size="sm"
                  variant={retentionType === "days" ? "default" : "ghost"}
                  className="h-7 px-3"
                  onClick={() => setRetentionType("days")}
                >
                  Days
                </Button>
              </div>
            </div>

            {retentionType === "size" ? (
              <div className="flex items-center gap-2">
                <TextInput
                  type="number"
                  min={1}
                  value={retentionMb}
                  onChange={(e) => setRetentionMb(Number(e.target.value))}
                  className="h-8 w-28 text-sm"
                />
                <span className="text-sm text-muted-foreground">MB</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <TextInput
                  type="number"
                  min={1}
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(Number(e.target.value))}
                  className="h-8 w-28 text-sm"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            )}
          </div>
        )}

        <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving…" : "Save"}
        </Button>
      </div>

      <Separator />

      {/* ── Restart behaviour ── */}
      <div className="flex flex-col gap-4 max-w-md">
        <div>
          <h3 className="text-sm font-semibold">Restart Behaviour</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Controls whether Podman restarts this container automatically.
          </p>
        </div>

        {isCompose ? (
          <div className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
            This container is managed by Compose. Set the{" "}
            <code className="font-mono text-xs bg-muted px-1 rounded">restart:</code>{" "}
            field in your compose file instead, then recreate the service.{" "}
            <Link
              to="/help"
              search={{ section: "compose" }}
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              See Help → Compose for details.
            </Link>
          </div>
        ) : !supportsRuntimeRestart ? (
          <div className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
            Requires Podman 5.0 or newer. You have{" "}
            <span className="font-mono text-xs">{info?.podman_version ?? "…"}</span>.
            Recreate the container with{" "}
            <code className="font-mono text-xs bg-muted px-1 rounded">podman run --restart=unless-stopped</code>{" "}
            to set a policy.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Select value={restartPolicy} onValueChange={setRestartPolicy}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">No — never restart</SelectItem>
                <SelectItem value="on-failure">On Failure — restart on non-zero exit</SelectItem>
                <SelectItem value="unless-stopped">Unless Stopped — restart unless manually stopped</SelectItem>
                <SelectItem value="always">Always — restart unconditionally</SelectItem>
              </SelectContent>
            </Select>

            {(restartPolicy === "unless-stopped" || restartPolicy === "always") && (
              <p className="text-xs text-muted-foreground">
                For this to survive a reboot, run{" "}
                <code className="font-mono bg-muted px-1 rounded">loginctl enable-linger</code>{" "}
                once to keep your user session active at boot.
              </p>
            )}

            <Button
              size="sm"
              onClick={() => restartPolicyMutation.mutate()}
              disabled={restartPolicyMutation.isPending}
            >
              {restartPolicyMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
