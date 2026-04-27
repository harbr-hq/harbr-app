import { Link, useNavigate } from "@tanstack/react-router";
import { type Container } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/containers/container-row";
import { ArrowRight, Boxes } from "lucide-react";

function ContainerMiniRow({ container }: { container: Container }) {
  const navigate = useNavigate();
  const imageShort = container.image.split("/").pop()?.split(":")[0] ?? container.image;

  return (
    <div
      className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-accent/60 cursor-pointer transition-colors"
      onClick={() =>
        void navigate({
          to: "/containers/$id",
          params: { id: container.id },
          search: { tab: "details" },
        })
      }
    >
      <StatusDot status={container.status} />
      <span className="font-medium text-sm truncate flex-1 min-w-0">{container.name}</span>
      <span className="text-xs text-muted-foreground truncate hidden md:block w-32 shrink-0">
        {imageShort}
      </span>
      <div className="hidden md:flex items-center gap-1 w-28 shrink-0 justify-end">
        {container.ports.slice(0, 2).map((p) => (
          <Badge
            key={p}
            variant="outline"
            className="font-mono text-xs px-1.5 py-0 shrink-0 bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/30"
          >
            {p.split(":")[0]}
          </Badge>
        ))}
        {container.ports.length > 2 && (
          <span className="text-xs text-muted-foreground shrink-0">+{container.ports.length - 2}</span>
        )}
      </div>
    </div>
  );
}

export function RunningContainersPanel({
  running,
  total,
  loading,
}: {
  running: Container[];
  total: number;
  loading: boolean;
}) {
  const shown = running.slice(0, 7);
  const stopped = total - running.length;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Running Containers</CardTitle>
          <Link
            to="/containers"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full rounded-md" />)}
          </div>
        ) : running.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
            <Boxes className="h-8 w-8 opacity-20" />
            <p className="text-sm">No containers running</p>
            {total > 0 && (
              <Link to="/containers" className="text-xs hover:text-foreground transition-colors">
                {total} stopped — start one →
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {shown.map((c) => <ContainerMiniRow key={c.id} container={c} />)}
            {(running.length > 7 || stopped > 0) && (
              <Link
                to="/containers"
                className="flex items-center justify-center gap-1 mt-2 pt-2 border-t border-border/40 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {running.length > 7 && <span>{running.length - 7} more running</span>}
                {running.length > 7 && stopped > 0 && <span>·</span>}
                {stopped > 0 && <span>{stopped} stopped</span>}
                <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
