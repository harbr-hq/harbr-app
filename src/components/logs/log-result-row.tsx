import { Badge } from "@/components/ui/badge";
import { type LogSearchResult } from "@/lib/api";
import { deterministicColour } from "@/lib/utils";

// ─── Container chip colours (deterministic by ID hash) ────────────────────

const CHIP_COLOURS = [
  "bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30",
  "bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30",
  "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30",
  "bg-lime-500/20 text-lime-600 dark:text-lime-400 border-lime-500/30",
  "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
  "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30",
  "bg-violet-500/20 text-violet-600 dark:text-violet-400 border-violet-500/30",
  "bg-pink-500/20 text-pink-600 dark:text-pink-400 border-pink-500/30",
  "bg-teal-500/20 text-teal-600 dark:text-teal-400 border-teal-500/30",
] as const;

export function chipColour(id: string): string {
  return deterministicColour(id, CHIP_COLOURS);
}

// ─── Highlighted log line ─────────────────────────────────────────────────

function HighlightedLine({ line, term }: { line: string; term: string }) {
  if (!term) return <span className="font-mono text-sm break-all">{line}</span>;

  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = line.split(new RegExp(`(${escaped})`, "gi"));
  const lowerTerm = term.toLowerCase();

  return (
    <span className="font-mono text-sm break-all">
      {parts.map((part, i) =>
        part.toLowerCase() === lowerTerm ? (
          <mark key={i} className="bg-yellow-300/40 text-inherit rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

// ─── Result row ───────────────────────────────────────────────────────────

export function ResultRow({
  result,
  term,
  containerName,
}: {
  result: LogSearchResult;
  term: string;
  containerName: string;
}) {
  const ts = result.ts
    ? new Date(String(result.ts)).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "";

  return (
    <div className="flex flex-col gap-0.5 px-3 py-2 hover:bg-muted/40 transition-colors">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium shrink-0 ${chipColour(result.container_id)}`}
        >
          {containerName}
        </span>
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 shrink-0 ${
            result.stream === "stderr"
              ? "border-red-500/40 text-red-500"
              : "border-green-500/40 text-green-600 dark:text-green-400"
          }`}
        >
          {result.stream}
        </Badge>
        <span className="shrink-0">{ts}</span>
      </div>
      <HighlightedLine line={result.line} term={term} />
    </div>
  );
}
