import { useNavigate } from "@tanstack/react-router";
import { type ComposeProject } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";

const COMPOSE_STATUS_DOT: Record<string, string> = {
  running:   "bg-green-500",
  partial:   "bg-amber-500",
  stopped:   "bg-muted-foreground/40",
  file_only: "bg-blue-500",
};

const COMPOSE_STATUS_LABEL: Record<string, string> = {
  running: "Running", partial: "Partial", stopped: "Stopped", file_only: "File only",
};

export function ComposeProjectCard({ project }: { project: ComposeProject }) {
  const navigate = useNavigate();
  const dot = COMPOSE_STATUS_DOT[project.status] ?? "bg-muted-foreground/40";
  const label = COMPOSE_STATUS_LABEL[project.status] ?? project.status;
  const running = project.services.filter((s) => s.status === "running").length;

  return (
    <Card
      className="cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={() =>
        void navigate({
          to: "/compose/$name",
          params: { name: project.name },
          search: { tab: "services", autoUp: false },
        })
      }
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-2.5">
          <span className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${dot}`} />
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{project.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {label}
              {project.services.length > 0 && (
                <> · {running}/{project.services.length} service{project.services.length !== 1 ? "s" : ""}</>
              )}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
