import { useCallback, useEffect, useState } from "react";
import { api, type PodmanEvent } from "@/lib/api";

const MAX_EVENTS = 500;

// ── Module-level shared state ───────────────────────────────

let _events: PodmanEvent[] = [];
let _connected = false;
let _paused = false;
let _pauseBuffer: PodmanEvent[] = [];
let _everConnected = false;
let _ws: WebSocket | null = null;
let _consumerCount = 0;
let _closeTimer: ReturnType<typeof setTimeout> | null = null;

const _listeners = new Set<() => void>();

function emit() {
  for (const cb of _listeners) cb();
}

// ── WebSocket lifecycle ─────────────────────────────────────

function openWs() {
  if (_ws) return;
  _everConnected = false;
  _ws = new WebSocket(api.events.wsUrl());

  _ws.onopen = () => {
    _everConnected = true;
    _connected = true;
    emit();
  };

  _ws.onclose = () => {
    _connected = false;
    _ws = null;
    emit();
    // Reconnect if consumers are still active (e.g. server restart).
    if (_consumerCount > 0) {
      setTimeout(() => {
        if (_consumerCount > 0 && !_ws) openWs();
      }, 2000);
    }
  };

  _ws.onerror = () => {
    if (!_everConnected) {
      _connected = false;
      emit();
    }
  };

  _ws.onmessage = (e) => {
    if (_consumerCount === 0) return;
    try {
      const event = JSON.parse(e.data as string) as PodmanEvent;
      if (_paused) {
        _pauseBuffer.push(event);
        emit();
      } else {
        const next = [..._events, event];
        _events = next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next;
        emit();
      }
    } catch {
      // Ignore malformed messages.
    }
  };
}

function closeWs() {
  _ws?.close();
  _ws = null;
  _everConnected = false;
  _connected = false;
  _events = [];
  _paused = false;
  _pauseBuffer = [];
  emit();
}

// ── Consumer registration ───────────────────────────────────

function register() {
  if (_closeTimer) {
    clearTimeout(_closeTimer);
    _closeTimer = null;
  }
  _consumerCount++;
  if (!_ws) openWs();
}

function unregister() {
  _consumerCount = Math.max(0, _consumerCount - 1);
  if (_consumerCount === 0) {
    _closeTimer = setTimeout(() => {
      _closeTimer = null;
      if (_consumerCount === 0) closeWs();
    }, 200);
  }
}

// ── Public hook ─────────────────────────────────────────────

export function useEvents() {
  const [, rerender] = useState(0);

  useEffect(() => {
    const cb = () => rerender((n) => n + 1);
    _listeners.add(cb);
    register();
    return () => {
      _listeners.delete(cb);
      unregister();
    };
  }, []);

  const pause = useCallback(() => {
    _paused = true;
    emit();
  }, []);

  const resume = useCallback(() => {
    _paused = false;
    if (_pauseBuffer.length > 0) {
      const merged = [..._events, ..._pauseBuffer];
      _events = merged.length > MAX_EVENTS ? merged.slice(merged.length - MAX_EVENTS) : merged;
      _pauseBuffer = [];
    }
    emit();
  }, []);

  const clear = useCallback(() => {
    _events = [];
    _pauseBuffer = [];
    emit();
  }, []);

  return {
    events: _events,
    connected: _connected,
    paused: _paused,
    bufferedCount: _pauseBuffer.length,
    pause,
    resume,
    clear,
  };
}
