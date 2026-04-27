import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Boxes, Database, Layers, Network, XCircle } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { api } from "@/lib/api";
import { useEvents } from "@/hooks/use-events";
import { StatCard } from "@/components/dashboard/stat-card";
import { RunningContainersPanel } from "@/components/dashboard/running-containers-panel";
import { ActivityPanel } from "@/components/dashboard/activity-panel";
import { ComposeProjectCard } from "@/components/dashboard/compose-projects-panel";
import { ResourceGraphPanel } from "@/components/dashboard/resource-graph-panel";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const { data: containers = [], isLoading: containersLoading } = useQuery({
    queryKey: ["containers"],
    queryFn: api.containers.list,
    refetchInterval: 10_000,
    staleTime: 9_000,
  });

  const { data: images = [], isLoading: imagesLoading } = useQuery({
    queryKey: ["images"],
    queryFn: api.images.list,
    refetchInterval: 30_000,
    staleTime: 29_000,
  });

  const { data: volumes = [], isLoading: volumesLoading } = useQuery({
    queryKey: ["volumes"],
    queryFn: api.volumes.list,
    refetchInterval: 30_000,
    staleTime: 29_000,
  });

  const { data: networks = [], isLoading: networksLoading } = useQuery({
    queryKey: ["networks"],
    queryFn: api.networks.list,
    refetchInterval: 30_000,
    staleTime: 29_000,
  });

  const { data: composeProjects = [] } = useQuery({
    queryKey: ["compose"],
    queryFn: api.compose.list,
    refetchInterval: 10_000,
    staleTime: 9_000,
  });

  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: api.health.get,
    staleTime: 4_000,
  });

  const { events, connected } = useEvents();

  const running = containers.filter((c) => c.status === "running");
  const totalImageSize = images.reduce((sum, img) => sum + img.size, 0);
  const portConflicts = health?.port_conflict_count ?? 0;
  const podmanOffline = health !== undefined && !health.podman_connected;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      {/* Alert banners */}
      {podmanOffline && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-600 dark:text-red-400">
          <XCircle className="h-4 w-4 shrink-0" />
          <span>Podman is offline — check that the Podman socket is running.</span>
        </div>
      )}
      {portConflicts > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {portConflicts} port conflict{portConflicts !== 1 ? "s" : ""} — multiple running containers share the same host port.
          </span>
          <Link to="/containers" className="ml-auto text-xs underline underline-offset-2 shrink-0 hover:opacity-80">
            View containers
          </Link>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Containers"
          icon={Boxes}
          value={running.length}
          subtext={containersLoading ? "loading…" : `running · ${containers.length} total`}
          href="/containers"
          loading={containersLoading}
        />
        <StatCard
          title="Images"
          icon={Layers}
          value={images.length}
          subtext={imagesLoading ? "loading…" : formatBytes(totalImageSize)}
          href="/images"
          loading={imagesLoading}
        />
        <StatCard
          title="Volumes"
          icon={Database}
          value={volumes.length}
          subtext={volumesLoading ? "loading…" : "stored"}
          href="/volumes"
          loading={volumesLoading}
        />
        <StatCard
          title="Networks"
          icon={Network}
          value={networks.length}
          subtext={networksLoading ? "loading…" : "configured"}
          href="/networks"
          loading={networksLoading}
        />
      </div>

      {/* Main panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <RunningContainersPanel
            running={running}
            total={containers.length}
            loading={containersLoading}
          />
          <ResourceGraphPanel runningIds={running.map((c) => c.id)} />
        </div>
        <div>
          <ActivityPanel events={events} connected={connected} />
        </div>
      </div>

      {/* Compose projects */}
      {composeProjects.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Compose Projects</h2>
            <Link
              to="/compose"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {composeProjects.slice(0, 8).map((p) => (
              <ComposeProjectCard key={p.name} project={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
