import { useEffect, useRef, useState } from "react";
import { type PullEvent, wsUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";
import { Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Download } from "lucide-react";

interface PullLine {
  text: string;
  isError: boolean;
}

export function PullSheet({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [imageRef, setImageRef] = useState("");
  const [lines, setLines] = useState<PullLine[]>([]);
  const [pulling, setPulling] = useState(false);
  const [done, setDone] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Auto-scroll the log as new lines arrive.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  // Close WS on unmount.
  useEffect(() => {
    return () => wsRef.current?.close();
  }, []);

  function reset() {
    setImageRef("");
    setLines([]);
    setPulling(false);
    setDone(false);
  }

  function handleClose(next: boolean) {
    if (!next) {
      wsRef.current?.close();
      reset();
    }
    setOpen(next);
  }

  function handlePull() {
    const ref = imageRef.trim();
    if (!ref || pulling) return;

    setLines([]);
    setDone(false);
    setPulling(true);

    const ws = new WebSocket(`${wsUrl("/images/pull")}&ref=${encodeURIComponent(ref)}`);
    wsRef.current = ws;

    ws.onmessage = (event: MessageEvent<string>) => {
      const msg = JSON.parse(event.data) as PullEvent;

      if (msg.type === "done") {
        setPulling(false);
        setDone(true);
        onDone();
      } else if (msg.type === "error") {
        setLines((prev) => [...prev, { text: msg.message, isError: true }]);
        setPulling(false);
      } else {
        // Collapse repeated progress lines for the same layer (keeps log readable).
        const line = [msg.status, msg.progress].filter(Boolean).join(" ");
        setLines((prev) => {
          const last = prev[prev.length - 1];
          if (last && !last.isError && last.text.startsWith(msg.status) && msg.progress) {
            return [...prev.slice(0, -1), { text: line, isError: false }];
          }
          return [...prev, { text: line, isError: false }];
        });
      }
    };

    ws.onclose = () => setPulling(false);
    ws.onerror = () => {
      setLines((prev) => [...prev, { text: "Connection failed", isError: true }]);
      setPulling(false);
    };
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 shrink-0">
          <Download className="h-3.5 w-3.5" />
          Pull
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col gap-4 w-[480px] sm:w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Pull Image</SheetTitle>
        </SheetHeader>

        <div className="flex gap-2">
          <TextInput
            placeholder="docker.io/library/nginx:latest"
            value={imageRef}
            onChange={(e) => setImageRef(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handlePull(); }}
            disabled={pulling}
          />
          <Button onClick={handlePull} disabled={pulling || !imageRef.trim()}>
            {pulling ? "Pulling…" : "Pull"}
          </Button>
        </div>

        {(pulling || lines.length > 0 || done) && (
          <div
            ref={logRef}
            className="flex-1 overflow-y-auto rounded-md bg-black p-3 font-mono text-xs min-h-48 max-h-[calc(100vh-240px)]"
          >
            {pulling && lines.length === 0 && (
              <div className="flex items-center gap-2 text-zinc-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Pulling…
              </div>
            )}
            {lines.map((line, i) => (
              <p
                key={i}
                className={line.isError ? "text-red-400" : "text-zinc-300"}
              >
                {line.text}
              </p>
            ))}
            {done && <p className="text-green-400 mt-2">✓ Done</p>}
          </div>
        )}

        {done && (
          <Button variant="outline" onClick={() => { reset(); setOpen(false); }}>
            Close
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
}
