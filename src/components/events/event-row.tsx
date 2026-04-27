import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { type PodmanEvent } from "@/lib/api";
import { actionColour, actionLabel, typeColour } from "@/components/events/event-colours";
import { formatDistanceToNow } from "date-fns";

// ─── Relative timestamp that refreshes every 10s ──────────────────────────

function RelativeTime({ timestamp }: { timestamp: number }) {
  const [label, setLabel] = useState(() =>
    formatDistanceToNow(new Date(timestamp * 1000), { addSuffix: true })
  );

  useEffect(() => {
    const id = setInterval(() => {
      setLabel(formatDistanceToNow(new Date(timestamp * 1000), { addSuffix: true }));
    }, 10_000);
    return () => clearInterval(id);
  }, [timestamp]);

  return (
    <span
      className="text-xs text-muted-foreground tabular-nums shrink-0 whitespace-nowrap"
      title={new Date(timestamp * 1000).toLocaleString()}
    >
      {label}
    </span>
  );
}

// ─── Single event row ─────────────────────────────────────────────────────

export function EventRow({ event }: { event: PodmanEvent }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-border/40 last:border-0 hover:bg-accent/40 transition-colors">
      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 font-mono ${typeColour(event.typ)}`}>
        {event.typ}
      </Badge>
      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 font-mono ${actionColour(event.action)}`}>
        {actionLabel(event.action)}
      </Badge>
      <span className="text-sm truncate flex-1 min-w-0">{event.actor_name}</span>
      <span className="font-mono text-xs text-muted-foreground w-24 shrink-0 hidden md:block truncate">
        {event.actor_id.length > 12 ? event.actor_id.slice(0, 12) : event.actor_id}
      </span>
      <RelativeTime timestamp={event.timestamp} />
    </div>
  );
}
