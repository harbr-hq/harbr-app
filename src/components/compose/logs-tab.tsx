import { useEffect, useMemo, useRef, useState } from "react";
import { useComposeLogs } from "@/hooks/use-compose-logs";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { deterministicColour } from "@/lib/utils";

// ─── Colour helpers (deterministic by service name) ───────────────────────

const SERVICE_COLOURS = [
  "text-rose-400",
  "text-orange-400",
  "text-amber-400",
  "text-lime-400",
  "text-emerald-400",
  "text-cyan-400",
  "text-blue-400",
  "text-violet-400",
  "text-pink-400",
  "text-teal-400",
] as const;

function serviceColour(name: string): string {
  return deterministicColour(name, SERVICE_COLOURS);
}

// ─── Logs tab ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  offline:    { dot: "bg-muted-foreground/40",           label: "Not running", labelClass: "text-muted-foreground" },
  connecting: { dot: "bg-amber-400 animate-pulse",       label: "Connecting…", labelClass: "text-amber-500 dark:text-amber-400" },
  streaming:  { dot: "bg-green-500 animate-pulse",       label: "Streaming",   labelClass: "text-green-600 dark:text-green-400" },
} as const;

export function LogsTab({ name, active }: { name: string; active: boolean }) {
  const { lines, status } = useComposeLogs(name, active);
  const indicator = STATUS_CONFIG[status];
  const [filter, setFilter] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const filtered = useMemo(() => {
    if (!filter) return lines;
    const q = filter.toLowerCase();
    return lines.filter((l) => l.line.toLowerCase().includes(q) || l.service.toLowerCase().includes(q));
  }, [lines, filter]);

  return (
    <div className="flex flex-col gap-2 mt-3">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full shrink-0 ${indicator.dot}`} />
        <span className={`text-xs ${indicator.labelClass}`}>{indicator.label}</span>

        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Filter logs…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
          {filter && (
            <button
              onClick={() => setFilter("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="h-[calc(100vh-16rem)] overflow-y-auto rounded-md bg-black p-4 font-mono text-xs">
        {filtered.length === 0 && (
          <span className="text-zinc-500">
            {lines.length === 0 ? "Waiting for logs…" : "No lines match the filter."}
          </span>
        )}
        {filtered.map((log, i) => (
          <div key={i} className={`flex gap-2 ${log.stream === "stderr" ? "text-red-400" : "text-zinc-100"}`}>
            <span className={`shrink-0 w-24 truncate ${serviceColour(log.service)}`}>
              {log.service}
            </span>
            <span>{log.line}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
