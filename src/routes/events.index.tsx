import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pause, Play, Trash2 } from "lucide-react";
import { useEvents } from "@/hooks/use-events";
import { typeColour } from "@/components/events/event-colours";
import { EventRow } from "@/components/events/event-row";

export const Route = createFileRoute("/events/")({
  component: EventsPage,
});

const TYPE_FILTERS = ["all", "container", "image", "volume", "network"] as const;
type TypeFilter = typeof TYPE_FILTERS[number];

export function EventsPage() {
  const { events, connected, paused, bufferedCount, pause, resume, clear } = useEvents();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const bottomRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => typeFilter === "all" ? events : events.filter((e) => e.typ === typeFilter),
    [events, typeFilter]
  );

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
          <p className="text-xs text-muted-foreground">
            Live events only — not persisted. Feed is shared with the Dashboard and resets when you navigate elsewhere.
          </p>
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-muted"}`} />
          {paused ? (
            <span className="text-yellow-500">
              paused{bufferedCount > 0 ? ` · ${bufferedCount} buffered` : ""}
            </span>
          ) : connected ? "live" : "connecting…"}
        </div>

        {events.length > 0 && (
          <Badge variant="secondary" className="tabular-nums">{events.length}</Badge>
        )}

        <div className="ml-auto flex items-center gap-2">
          {paused ? (
            <Button size="sm" variant="outline" className="gap-1.5 text-green-500 border-green-500/40 hover:bg-green-500/10" onClick={resume}>
              <Play className="h-3.5 w-3.5" />
              Resume
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={pause}>
              <Pause className="h-3.5 w-3.5" />
              Pause
            </Button>
          )}
          <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={clear} disabled={events.length === 0}>
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </div>

      {/* ── Type filter chips ── */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setTypeFilter(f)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
              typeFilter === f
                ? f === "all"
                  ? "bg-foreground text-background border-foreground"
                  : `${typeColour(f)} border-current`
                : "bg-transparent text-muted-foreground border-border hover:bg-accent"
            }`}
          >
            {f}
            {f !== "all" && events.filter((e) => e.typ === f).length > 0 && (
              <span className="ml-1 tabular-nums opacity-70">
                {events.filter((e) => e.typ === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Event feed ── */}
      <div className="flex-1 rounded-lg border overflow-y-auto min-h-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-center px-6">
            <p className="text-sm text-muted-foreground">
              {connected ? "No events yet" : "Connecting to Podman…"}
            </p>
            {connected && (
              <p className="text-xs text-muted-foreground/70 max-w-sm">
                Events appear here automatically. Start, stop, or remove a container and
                you'll see it show up in real time.
              </p>
            )}
          </div>
        ) : (
          <>
            {filtered.map((event, i) => (
              <EventRow key={`${event.timestamp}-${event.actor_id}-${i}`} event={event} />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>
    </div>
  );
}
