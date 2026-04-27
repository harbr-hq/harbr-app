import { useCallback, useEffect, useRef, useState } from "react";

export interface OutputLine {
  stream: "stdout" | "stderr";
  line: string;
}

interface UseComposeOutputResult {
  lines: OutputLine[];
  exitCode: number | null;
  running: boolean;
  clear: () => void;
}

type ServerMsg =
  | { type: "line"; stream: "stdout" | "stderr"; line: string }
  | { type: "exit"; code: number }
  | { type: "error"; message: string };

export function useComposeOutput(wsUrl: string | null): UseComposeOutputResult {
  const [lines, setLines] = useState<OutputLine[]>([]);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!wsUrl) return;

    wsRef.current?.close();
    setLines([]);
    setExitCode(null);
    setRunning(true);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event: MessageEvent<string>) => {
      const msg = JSON.parse(event.data) as ServerMsg;
      if (msg.type === "line") {
        setLines((prev) => [...prev, { stream: msg.stream, line: msg.line }]);
      } else if (msg.type === "exit") {
        setExitCode(msg.code);
        setRunning(false);
      } else if (msg.type === "error") {
        setLines((prev) => [
          ...prev,
          { stream: "stderr", line: `Error: ${msg.message}` },
        ]);
        setRunning(false);
      }
    };

    ws.onclose = () => setRunning(false);
    ws.onerror = () => {
      setLines((prev) => [
        ...prev,
        { stream: "stderr", line: "WebSocket connection failed" },
      ]);
      setRunning(false);
    };

    return () => {
      ws.close();
    };
  }, [wsUrl]);

  const clear = useCallback(() => {
    setLines([]);
    setExitCode(null);
  }, []);

  return { lines, exitCode, running, clear };
}
