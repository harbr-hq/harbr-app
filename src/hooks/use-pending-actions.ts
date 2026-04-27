import { useEffect, useState } from "react";

/// Container actions initiated outside the row component (e.g. from the
/// system tray) that the row should reflect with optimistic pending UI.
export type PendingAction = "stop" | "start" | "restart";

// ── Module-level shared state ─────────────────────────────────────────────

const _pending = new Map<string, PendingAction>();
const _listeners = new Set<() => void>();

function emit() {
  for (const cb of _listeners) cb();
}

// ── Public mutators ───────────────────────────────────────────────────────

export function setPendingAction(id: string, action: PendingAction) {
  _pending.set(id, action);
  emit();
}

export function clearPendingAction(id: string) {
  if (_pending.delete(id)) emit();
}

export function clearAllPendingActions() {
  if (_pending.size === 0) return;
  _pending.clear();
  emit();
}

// ── Hook ──────────────────────────────────────────────────────────────────

/// Subscribes to the pending-actions store. Returns the action queued for
/// `id`, or null if none.
export function usePendingAction(id: string): PendingAction | null {
  const [, force] = useState({});
  useEffect(() => {
    const fn = () => force({});
    _listeners.add(fn);
    return () => {
      _listeners.delete(fn);
    };
  }, []);
  return _pending.get(id) ?? null;
}
