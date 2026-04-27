import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

export interface ComposeLogLine {
  service: string;
  stream: "stdout" | "stderr";
  line: string;
}

export type ComposeLogStatus = "offline" | "connecting" | "streaming";

interface UseComposeLogsResult {
  lines: ComposeLogLine[];
  status: ComposeLogStatus;
}

type ServerMsg =
  | { kind: "ready" }
  | { kind?: never; service: string; stream: "stdout" | "stderr"; line: string };

const RETRY_DELAY_MS = 3_000;

export function useComposeLogs(projectName: string, enabled: boolean): UseComposeLogsResult {
  const [lines, setLines] = useState<ComposeLogLine[]>([]);
  const [status, setStatus] = useState<ComposeLogStatus>("offline");
  const wsRef = useRef<WebSocket | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Incremented to re-trigger the effect after a retry delay.
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    if (!enabled) {
      wsRef.current?.close();
      setStatus("offline");
      return;
    }

    const url = api.compose.logsWsUrl(projectName);
    const ws = new WebSocket(url);
    wsRef.current = ws;
    let everConnected = false;
    let manualClose = false;

    // Only show "connecting" if the attempt is still pending after 400ms.
    // Failed connections (compose not running) resolve in <50ms so this
    // avoids the amber flash on every retry cycle.
    const connectingTimer = setTimeout(() => setStatus("connecting"), 400);

    ws.onopen = () => {
      clearTimeout(connectingTimer);
      everConnected = true;
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      const msg = JSON.parse(event.data) as ServerMsg;
      if (msg.kind === "ready") {
        setStatus("streaming");
        return;
      }
      setLines((prev) => [
        ...prev,
        { service: msg.service, stream: msg.stream, line: msg.line },
      ]);
    };

    ws.onclose = () => {
      clearTimeout(connectingTimer);
      setStatus("offline");
      // Don't retry if we closed it ourselves (disabled or unmounted).
      if (!manualClose) {
        retryTimerRef.current = setTimeout(
          () => setRevision((r) => r + 1),
          RETRY_DELAY_MS,
        );
      }
    };

    ws.onerror = () => {
      if (everConnected) setStatus("offline");
    };

    return () => {
      manualClose = true;
      clearTimeout(connectingTimer);
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      ws.close();
      setStatus("offline");
    };
  }, [projectName, enabled, revision]);

  return { lines, status };
}
