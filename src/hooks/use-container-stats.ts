import { useEffectEvent, useEffect, useRef, useState } from "react";
import { api, wsUrl } from "@/lib/api";

export interface StatsSnapshot {
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
  timestamp: number;
}

interface RawSnapshot {
  cpu_percent: number;
  memory_usage: number;
  memory_limit: number;
  memory_percent: number;
}

const HISTORY_SIZE = 60;

export function useContainerStats(containerId: string) {
  const [history, setHistory] = useState<StatsSnapshot[]>([]);
  const [connected, setConnected] = useState(false);
  // True once the WebSocket has delivered at least one live frame.
  // Used by the UI to gate between skeleton and chart — ensures the chart
  // appears with real streaming data rather than a single flat snapshot point.
  const [wsReady, setWsReady] = useState(false);
  const everConnected = useRef(false);
  // Prevents a slow snapshot response from overwriting real WebSocket data.
  const wsStarted = useRef(false);

  // useEffectEvent: the onmessage handler always captures the current closure
  // without being a dependency — prevents spurious WebSocket reconnects.
  const onMessage = useEffectEvent((event: MessageEvent<string>) => {
    wsStarted.current = true;
    try {
      const raw = JSON.parse(event.data) as RawSnapshot;
      const snapshot: StatsSnapshot = {
        cpuPercent: raw.cpu_percent,
        memoryUsage: raw.memory_usage,
        memoryLimit: raw.memory_limit,
        memoryPercent: raw.memory_percent,
        timestamp: Date.now(),
      };
      setHistory((prev) => [...prev.slice(-(HISTORY_SIZE - 1)), snapshot]);
      setWsReady(true);
    } catch {
      // malformed frame — ignore
    }
  });

  useEffect(() => {
    setHistory([]);
    setWsReady(false);
    everConnected.current = false;
    wsStarted.current = false;

    if (!containerId) return;

    // Fetch a snapshot immediately to seed the chart while the WebSocket warms up.
    // The stream discards its first reading for CPU accuracy, adding ~1 s of blank chart.
    void api.containers
      .statsSnapshot(containerId)
      .then((snap) => {
        if (wsStarted.current) return;
        setHistory([{
          cpuPercent: snap.cpu_percent,
          memoryUsage: snap.memory_usage,
          memoryLimit: snap.memory_limit,
          memoryPercent: snap.memory_percent,
          timestamp: Date.now(),
        }]);
      })
      .catch(() => void 0);

    const ws = new WebSocket(wsUrl(`/containers/${containerId}/stats`));

    ws.onopen = () => {
      everConnected.current = true;
      setConnected(true);
    };
    ws.onclose = () => setConnected(false);
    ws.onerror = () => {
      if (!everConnected.current) setConnected(false);
    };

    ws.onmessage = onMessage;

    return () => ws.close();
  }, [containerId]);

  return {
    history,
    current: history[history.length - 1] ?? null,
    connected,
    wsReady,
  };
}
