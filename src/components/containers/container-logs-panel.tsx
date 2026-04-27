import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useContainerLogs } from "@/hooks/use-container-logs";
import { Pause, Play, Search, X } from "lucide-react";

/** Convert a wildcard pattern (* ?) to a case-insensitive RegExp. */
function wildcardToRegex(pattern: string): RegExp | null {
  const trimmed = pattern.trim();
  if (!trimmed) return null;
  try {
    const escaped = trimmed.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    const regexStr = escaped.replace(/\*/g, ".*").replace(/\?/g, ".");
    return new RegExp(regexStr, "i");
  } catch {
    return null;
  }
}

/** Render a log line with matched portions highlighted. */
function HighlightedLine({ line, regex }: { line: string; regex: RegExp | null }) {
  if (!regex) return <>{line}</>;

  const parts: React.ReactNode[] = [];
  const global = new RegExp(regex.source, "gi");
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = global.exec(line)) !== null) {
    if (match.index > lastIndex) parts.push(line.slice(lastIndex, match.index));
    parts.push(
      <mark key={match.index} className="bg-yellow-400/25 text-yellow-200 rounded-sm">
        {match[0]}
      </mark>,
    );
    lastIndex = global.lastIndex;
    if (match[0].length === 0) { global.lastIndex++; break; }
  }
  if (lastIndex < line.length) parts.push(line.slice(lastIndex));
  return <>{parts}</>;
}

export function LogsPanel({ containerId, isRunning }: { containerId: string; isRunning: boolean }) {
  // Live filter — applied to displayed lines as the user types.
  const [filter, setFilter] = useState("");
  // Committed filter — sent to the backend on resume to reduce stream noise.
  const [committedFilter, setCommittedFilter] = useState("");

  const { logs, connected, error, paused, bufferedCount, bufferFull, pause, resume } =
    useContainerLogs(containerId, committedFilter);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new lines. While paused, logs don't change so this won't fire.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Defer the regex/filter work so fast typing doesn't block the input.
  const deferredFilter = useDeferredValue(filter);
  const filterRegex = useMemo(() => wildcardToRegex(deferredFilter), [deferredFilter]);

  const displayedLogs = useMemo(
    () => (filterRegex ? logs.filter((l) => filterRegex.test(l.line)) : logs),
    [logs, filterRegex],
  );

  const handleResume = () => {
    // Commit the current filter to the backend — if it changed, the hook reconnects.
    setCommittedFilter(filter);
    resume();
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        {/* Status */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
          <span className={`h-2 w-2 rounded-full ${connected && isRunning ? "bg-green-500 animate-pulse" : isRunning ? "bg-amber-400 animate-pulse" : "bg-muted-foreground/40"}`} />
          {paused ? (
            bufferFull ? (
              <span className="text-red-400">
                buffer full · {bufferedCount} lines dropped — resume to continue
              </span>
            ) : (
              <span className="text-yellow-400">
                paused{bufferedCount > 0 && ` · ${bufferedCount} new`}
              </span>
            )
          ) : connected && isRunning ? (
            <span className="text-green-600 dark:text-green-400">Streaming</span>
          ) : isRunning ? (
            <span className="text-amber-500 dark:text-amber-400">Connecting…</span>
          ) : (
            <span>Not running</span>
          )}
          {error && <span className="text-destructive ml-1">{error}</span>}
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Filter logs… (* and ? wildcards)"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={`h-8 pl-8 text-xs font-mono ${filter ? "pr-16" : "pr-3"}`}
          />
          {filter && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {filterRegex && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {displayedLogs.length}/{logs.length}
                </span>
              )}
              <button
                onClick={() => setFilter("")}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear filter"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Pause / Resume */}
        {paused ? (
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-green-400 border-green-400/40 hover:bg-green-400/10 shrink-0" onClick={handleResume}>
            <Play className="h-3.5 w-3.5" />
            Resume
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="h-8 gap-1.5 shrink-0" onClick={pause}>
            <Pause className="h-3.5 w-3.5" />
            Pause
          </Button>
        )}
      </div>

      {/* Log output */}
      <div className="h-[calc(100vh-18rem)] overflow-y-auto rounded-md bg-black p-4 font-mono text-xs">
        {displayedLogs.length === 0 && (
          <span className="text-zinc-500">
            {logs.length === 0 ? "Waiting for logs…" : "No lines match the filter."}
          </span>
        )}
        {displayedLogs.map((log, i) => (
          <div
            key={i}
            className={log.stream === "stderr" ? "text-red-400" : "text-zinc-100"}
          >
            <HighlightedLine line={log.line} regex={filterRegex} />
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
