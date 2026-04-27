import { Link } from "@tanstack/react-router";
import { type PodmanEvent } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { actionColour, actionLabel, typeColour } from "@/components/events/event-colours";
import { ArrowRight } from "lucide-react";

export function ActivityPanel({
  events,
  connected,
}: {
  events: PodmanEvent[];
  connected: boolean;
}) {
  const recent = [...events].reverse().slice(0, 10);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <span
              className={`h-1.5 w-1.5 rounded-full shrink-0 ${connected ? "bg-green-500" : "bg-muted-foreground/40"}`}
            />
          </div>
          <Link
            to="/events"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
            <p className="text-sm text-muted-foreground">No activity yet</p>
            <p className="text-xs text-muted-foreground/70 max-w-[200px]">
              Events appear here automatically when containers start, stop, or change state.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recent.map((event, i) => (
              <div key={i} className="flex items-center gap-1.5 min-w-0">
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 shrink-0 font-mono ${typeColour(event.typ)}`}
                >
                  {event.typ}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 shrink-0 font-mono ${actionColour(event.action)}`}
                >
                  {actionLabel(event.action)}
                </Badge>
                <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">
                  {event.actor_name}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
