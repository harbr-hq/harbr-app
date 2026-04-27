import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OutputLine } from "@/hooks/use-compose-output";
import { Loader2, Trash2 } from "lucide-react";

interface ComposeOutputProps {
  lines: OutputLine[];
  exitCode: number | null;
  running: boolean;
  onClear: () => void;
}

export function ComposeOutput({ lines, exitCode, running, onClear }: ComposeOutputProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const exitBadge =
    exitCode === null ? null : exitCode === 0 ? (
      <Badge className="bg-green-600 hover:bg-green-700 text-white text-xs">
        Exit 0 — success
      </Badge>
    ) : (
      <Badge variant="destructive" className="text-xs">
        Exit {exitCode} — failed
      </Badge>
    );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {running && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Running…
          </span>
        )}
        {exitBadge}
        <div className="ml-auto">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onClear}
            disabled={running}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="h-64 overflow-y-auto rounded-md bg-black p-3 font-mono text-xs">
        {lines.length === 0 && (
          <span className="text-zinc-500">
            {running ? "Waiting for output…" : "No output."}
          </span>
        )}
        {lines.map((l, i) => (
          <p key={i} className={l.stream === "stderr" ? "text-zinc-400" : "text-zinc-100"}>
            {l.line}
          </p>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
