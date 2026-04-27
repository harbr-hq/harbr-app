import { useEffect, useState } from "react";

export type ComposeTrayAction = "up" | "down" | "restart";

const _pending = new Map<string, ComposeTrayAction>();
const _listeners = new Set<() => void>();

function emit() {
  for (const cb of _listeners) cb();
}

export function setComposePending(name: string, action: ComposeTrayAction) {
  _pending.set(name, action);
  emit();
}

export function clearComposePending(name: string) {
  if (_pending.delete(name)) emit();
}

export function clearAllComposePending() {
  if (_pending.size === 0) return;
  _pending.clear();
  emit();
}

export function useComposePending(name: string): ComposeTrayAction | null {
  const [, force] = useState({});
  useEffect(() => {
    const fn = () => force({});
    _listeners.add(fn);
    return () => { _listeners.delete(fn); };
  }, []);
  return _pending.get(name) ?? null;
}
