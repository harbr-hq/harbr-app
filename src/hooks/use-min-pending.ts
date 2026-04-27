import { useEffect, useRef, useState } from "react";

/** Keeps `true` for at least `minMs` after `isPending` was last true. */
export function useMinPending(isPending: boolean, minMs = 700): boolean {
  const [held, setHeld] = useState(isPending);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (isPending) {
      clearTimeout(timer.current);
      setHeld(true);
    } else {
      timer.current = setTimeout(() => setHeld(false), minMs);
    }
    return () => clearTimeout(timer.current);
  }, [isPending, minMs]);

  return held;
}
