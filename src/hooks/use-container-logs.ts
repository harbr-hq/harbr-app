import { useEffectEvent, useCallback, useEffect, useRef, useState } from "react";
import { wsUrl } from "@/lib/api";

const MAX_BUFFER  = 1_000;
const MAX_DISPLAY = 10_000;

export interface LogLine {
  stream: "stdout" | "stderr";
  line: string;
}

/**
 * Streams container logs over WebSocket with pause/resume and backend filtering.
 *
 * @param containerId     - The container to stream from. Changing this reconnects.
 * @param committedFilter - Sent to the backend as ?filter=. Only update on resume
 *   so the backend reconnects with the new filter. Changing mid-stream reconnects
 *   and clears the log buffer.
 */
export function useContainerLogs(containerId: string, committedFilter: string) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [bufferedCount, setBufferedCount] = useState(0);
  const [bufferFull, setBufferFull] = useState(false);

  // Buffer accumulates lines while paused — a ref so it doesn't trigger re-renders.
  const bufferRef = useRef<LogLine[]>([]);
  const everConnected = useRef(false);

  const pause = useCallback(() => {
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    setPaused(false);
    setBufferFull(false);
    if (bufferRef.current.length > 0) {
      setLogs((prev) => [...prev, ...bufferRef.current]);
      bufferRef.current = [];
      setBufferedCount(0);
    }
  }, []);

  // useEffectEvent: always reads the latest `paused` state without being a
  // dependency of the effect — prevents unnecessary WebSocket reconnects.
  const onMessage = useEffectEvent((event: MessageEvent<string>) => {
    try {
      const msg = JSON.parse(event.data) as LogLine;
      if (paused) {
        if (bufferRef.current.length >= MAX_BUFFER) {
          // Buffer full — drop incoming lines and warn. The user needs to resume.
          setBufferFull(true);
          return;
        }
        bufferRef.current = [...bufferRef.current, msg];
        setBufferedCount(bufferRef.current.length);
      } else {
        setLogs((prev) => {
          const next = [...prev, msg];
          return next.length > MAX_DISPLAY ? next.slice(-MAX_DISPLAY) : next;
        });
      }
    } catch {
      // malformed frame — ignore
    }
  });

  useEffect(() => {
    // Full reset when container or committed filter changes.
    bufferRef.current = [];
    everConnected.current = false;
    setPaused(false);
    setBufferedCount(0);
    setBufferFull(false);
    setLogs([]);
    setError(null);

    if (!containerId) return;

    const base = wsUrl(`/containers/${containerId}/logs`);
    const url = committedFilter
      ? `${base}&filter=${encodeURIComponent(committedFilter)}`
      : base;

    const ws = new WebSocket(url);

    ws.onopen = () => {
      everConnected.current = true;
      setConnected(true);
      setError(null);
    };
    ws.onclose = () => setConnected(false);
    ws.onerror = () => {
      // WebKit fires onerror on clean close too — only surface if we never connected.
      if (!everConnected.current) setError("Failed to connect to log stream");
    };

    ws.onmessage = onMessage;

    return () => ws.close();
  }, [containerId, committedFilter]);

  return { logs, connected, error, paused, bufferedCount, bufferFull, pause, resume };
}
