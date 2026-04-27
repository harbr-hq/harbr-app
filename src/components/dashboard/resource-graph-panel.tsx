import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type StatsSnapshot } from "@/lib/api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface AggregatePoint {
  t: number;
  cpu: number;    // sum of all containers' CPU %
  mem: number;    // sum of all containers' memory %
}

const HISTORY = 60;
const POLL_MS = 5_000;

export function ResourceGraphPanel({ runningIds }: { runningIds: string[] }) {
  const [history, setHistory] = useState<AggregatePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const prevIdsRef = useRef<string>("");

  useEffect(() => {
    // Reset when the set of running containers changes.
    const key = [...runningIds].sort().join(",");
    if (key !== prevIdsRef.current) {
      prevIdsRef.current = key;
      setHistory([]);
      setLoading(true);
    }

    if (runningIds.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      try {
        const snapshots = await Promise.all(
          runningIds.map((id) => api.containers.statsSnapshot(id).catch(() => null)),
        );

        const valid = snapshots.filter((s): s is StatsSnapshot => s !== null);
        if (valid.length === 0) return;

        const cpu = valid.reduce((sum, s) => sum + s.cpu_percent, 0);
        const mem = valid.reduce((sum, s) => sum + s.memory_percent, 0);

        setHistory((prev) => [
          ...prev.slice(-(HISTORY - 1)),
          { t: Date.now(), cpu, mem },
        ]);
        setLoading(false);
      } catch {
        // Silently ignore — next poll will retry.
      }
    }

    void poll();
    const interval = setInterval(() => void poll(), POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [runningIds]);

  const current = history[history.length - 1];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Resource Usage — All Containers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {runningIds.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No running containers</p>
        ) : loading ? (
          <div className="space-y-3">
            <Skeleton className="h-[80px] w-full" />
            <Skeleton className="h-[80px] w-full" />
          </div>
        ) : (
          <>
            {/* CPU */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>CPU</span>
                <span className="text-orange-500 font-medium">
                  {current ? `${current.cpu.toFixed(1)}%` : "—"}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={70}>
                <AreaChart data={history} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dash-cpu-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" hide />
                  <YAxis domain={[0, 100]} hide />
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload?.[0] ? (
                        <div className="rounded border bg-popover px-2 py-1 text-xs shadow">
                          {(payload[0].value as number).toFixed(1)}% CPU
                        </div>
                      ) : null
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="cpu"
                    stroke="#f97316"
                    strokeWidth={1.5}
                    fill="url(#dash-cpu-grad)"
                    isAnimationActive={false}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Memory */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Memory</span>
                <span className="text-purple-500 font-medium">
                  {current ? `${current.mem.toFixed(1)}%` : "—"}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={70}>
                <AreaChart data={history} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dash-mem-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" hide />
                  <YAxis domain={[0, 100]} hide />
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload?.[0] ? (
                        <div className="rounded border bg-popover px-2 py-1 text-xs shadow">
                          {(payload[0].value as number).toFixed(1)}% Memory
                        </div>
                      ) : null
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="mem"
                    stroke="#a855f7"
                    strokeWidth={1.5}
                    fill="url(#dash-mem-grad)"
                    isAnimationActive={false}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
