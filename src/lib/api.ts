const API_BASE = "http://localhost:9090/api/v1";
const WS_BASE = "ws://localhost:9090/api/v1";

export interface Container {
  id: string;
  name: string;
  image: string;
  status: "running" | "stopped" | "paused" | "exited" | "unknown";
  created: number;
  ports: string[];
  compose_project: string | null;
  compose_service: string | null;
}

export type GroupKind = "compose" | "custom" | "ungrouped";

export interface ContainerGroup {
  id: string;
  name: string;
  kind: GroupKind;
  locked: boolean;
  colour: string | null;
  container_ids: string[];
}

export interface CreateGroupRequest {
  name: string;
}

export interface UpdateGroupRequest {
  name?: string;
  colour?: string | null;
}

export interface SetGroupOrderRequest {
  container_ids: string[];
}

export interface AssignContainerRequest {
  container_id: string;
}

export interface PortMapping {
  host_port: number;
  container_port: number;
  proto?: string;
}

export interface RunContainerRequest {
  image: string;
  name?: string;
  ports?: PortMapping[];
  env?: string[];
  cmd?: string[];
}

export interface StatsSnapshot {
  cpu_percent: number;
  memory_usage: number;
  memory_limit: number;
  memory_percent: number;
}

export interface ContainerSettings {
  container_id: string;
  persistent_logs: boolean;
  /** `"size"` or `"days"` */
  retention_type: "size" | "days";
  retention_days: number | null;
  retention_mb: number;
}

let authToken = "";

/** Called once on startup after fetching the token via Tauri IPC. */
export function setApiToken(token: string): void {
  authToken = token;
}

/** Construct an authenticated WebSocket URL. Token goes in the query param
 *  since WebSocket connections can't set custom headers. */
export function wsUrl(path: string): string {
  return `${WS_BASE}${path}?token=${authToken}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${authToken}`,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const msg = `API ${res.status} ${res.statusText}${body ? `: ${body}` : ""}`;
    throw new Error(msg);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface Image {
  /** Full content-addressable ID (sha256:...). */
  id: string;
  /** All repo:tag pairs that reference this image. Empty = untagged. */
  repo_tags: string[];
  /** Unix timestamp of image creation. */
  created: number;
  /** Total size in bytes including all layers. */
  size: number;
  /** Number of containers using this image. -1 means not calculated. */
  containers: number;
}

export interface ImageDetails {
  architecture: string | null;
  os: string | null;
  author: string | null;
  docker_version: string | null;
  cmd: string[];
  entrypoint: string[];
  env: string[];
  exposed_ports: string[];
  labels: Record<string, string>;
}

export interface PruneResult {
  deleted_count: number;
  space_reclaimed: number;
}

export type PullEvent =
  | { type: "progress"; status: string; progress: string | null }
  | { type: "done" }
  | { type: "error"; message: string };

export interface ContainerNetwork {
  name: string;
  ip: string | null;
  gateway: string | null;
  mac: string | null;
  prefix_len: number | null;
}

export interface ContainerMount {
  mount_type: string;
  name: string | null;
  source: string | null;
  destination: string;
  mode: string;
  rw: boolean;
}

export interface ContainerPort {
  host_ip: string | null;
  host_port: number | null;
  container_port: number;
  proto: string;
}

export interface ContainerInspect {
  id: string;
  name: string;
  image: string;
  image_id: string;
  created: string | null;
  command: string[];
  entrypoint: string[];
  working_dir: string;
  hostname: string;
  env: string[];
  labels: Record<string, string>;
  networks: ContainerNetwork[];
  mounts: ContainerMount[];
  ports: ContainerPort[];
  restart_policy: string;
  memory_limit: number | null;
  pid: number | null;
  exit_code: number | null;
}

export interface LogSearchRequest {
  term?: string;
  container_ids: string[];
  /** `"stdout"`, `"stderr"`, or `"all"` */
  stream?: string;
  /** Unix epoch seconds — only return logs at or after this time. */
  since_secs?: number;
  limit?: number;
  offset?: number;
  /** `"desc"` (newest first, default) or `"asc"` (oldest first). */
  order?: "asc" | "desc";
}

export interface LogSearchResult {
  container_id: string;
  stream: string;
  line: string;
  /** ISO 8601 string from SurrealDB. */
  ts: string;
}

export interface LogSearchResponse {
  results: LogSearchResult[];
  /** True when there may be more results (result count == limit). */
  has_more: boolean;
}

export interface Volume {
  name: string;
  driver: string;
  mountpoint: string;
  created_at: string | null;
  scope: string;
  labels: Record<string, string>;
  options: Record<string, string>;
  /** Disk usage in bytes. -1 = not calculated. */
  size: number;
  /** Container ref count. -1 = not calculated. */
  ref_count: number;
}

export interface VolumeContainer {
  id: string;
  name: string;
  status: string;
}

export interface VolumeFileEntry {
  name: string;
  /** Path relative to the volume root, e.g. "/subdir/file.txt". */
  path: string;
  is_dir: boolean;
  size: number;
  /** Unix timestamp of last modification. */
  modified: number | null;
}

export interface NetworkMember {
  id: string;
  name: string;
  ipv4_address: string | null;
}

export interface Network {
  id: string;
  name: string;
  driver: string;
  scope: string;
  subnet: string | null;
  gateway: string | null;
  internal: boolean;
  created: string | null;
  container_count: number;
  labels: Record<string, string>;
  containers: NetworkMember[];
}

export type ComposeStatus = "running" | "partial" | "stopped" | "file_only";

export interface ComposeService {
  name: string;
  image: string | null;
  status: string;
  container_id: string | null;
  ports: string[];
}

export interface ComposeProject {
  name: string;
  status: ComposeStatus;
  services: ComposeService[];
  file_path: string | null;
  file_managed: boolean;
  working_dir: string | null;
}

export interface ComposeFileContent {
  content: string;
  path: string;
}

export interface ValidateResult {
  valid: boolean;
  errors: string[];
}

export interface HealthStatus {
  podman_connected: boolean;
  running_count: number;
  port_conflict_count: number;
}

export interface AppInfo {
  app_version: string;
  podman_version: string;
  socket_path: string;
  compose_bin: string | null;
  compose_dirs: string[];
  config_file: string;
  data_dir: string;
  daemon_port: number;
}

export interface PodmanEvent {
  typ: string;
  action: string;
  actor_id: string;
  actor_name: string;
  timestamp: number;
  attributes: Record<string, string>;
}

export const api = {
  images: {
    list: () => request<Image[]>("/images"),
    remove: (id: string, force = false) =>
      request<void>(`/images/${id}${force ? "?force=true" : ""}`, { method: "DELETE" }),
    prune: () => request<PruneResult>("/images/prune", { method: "POST" }),
    inspect: (id: string) => request<ImageDetails>(`/images/${id}/inspect`),
  },
  containers: {
    list: () => request<Container[]>("/containers"),
    run: (req: RunContainerRequest) =>
      request<void>("/containers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      }),
    stop: (id: string) => request<void>(`/containers/${id}/stop`, { method: "POST" }),
    start: (id: string) => request<void>(`/containers/${id}/start`, { method: "POST" }),
    pause: (id: string) => request<void>(`/containers/${id}/pause`, { method: "POST" }),
    unpause: (id: string) => request<void>(`/containers/${id}/unpause`, { method: "POST" }),
    remove: (id: string) => request<void>(`/containers/${id}`, { method: "DELETE" }),
    statsSnapshot: (id: string) => request<StatsSnapshot>(`/containers/${id}/stats/snapshot`),
    inspect: (id: string) => request<ContainerInspect>(`/containers/${id}/inspect`),
    setRestartPolicy: (id: string, policy: string) =>
      request<void>(`/containers/${id}/restart-policy`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policy }),
      }),
  },
  logs: {
    search: (req: LogSearchRequest) =>
      request<LogSearchResponse>("/logs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      }),
    clearAll: () => request<void>("/logs", { method: "DELETE" }),
    loggedContainers: () =>
      request<{ container_ids: string[] }>("/logs/containers"),
  },
  networks: {
    list: () => request<Network[]>("/networks"),
    create: (name: string, driver = "bridge") =>
      request<void>("/networks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, driver }),
      }),
    remove: (id: string) => request<void>(`/networks/${id}`, { method: "DELETE" }),
    prune: () => request<{ deleted_count: number }>("/networks/prune", { method: "POST" }),
  },
  volumes: {
    list: () => request<Volume[]>("/volumes"),
    create: (name: string, driver = "local") =>
      request<Volume>("/volumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, driver }),
      }),
    remove: (name: string) =>
      request<void>(`/volumes/${encodeURIComponent(name)}`, { method: "DELETE" }),
    prune: () => request<PruneResult>("/volumes/prune", { method: "POST" }),
    containers: (name: string) =>
      request<VolumeContainer[]>(`/volumes/${encodeURIComponent(name)}/containers`),
    browse: (name: string, path = "/") =>
      request<VolumeFileEntry[]>(
        `/volumes/${encodeURIComponent(name)}/files?path=${encodeURIComponent(path)}`,
      ),
  },
  settings: {
    get: (containerId: string) =>
      request<ContainerSettings>(`/containers/${containerId}/settings`),
    update: (containerId: string, patch: Partial<Omit<ContainerSettings, "container_id">>) =>
      request<ContainerSettings>(`/containers/${containerId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }),
  },
  groups: {
    list: () => request<ContainerGroup[]>("/groups"),
    create: (req: CreateGroupRequest) =>
      request<{ group_id: string; name: string; container_ids: string[] }>("/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      }),
    update: (id: string, req: UpdateGroupRequest) =>
      request<{ group_id: string; name: string; colour: string | null; container_ids: string[] }>(
        `/groups/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req),
        },
      ),
    remove: (id: string) => request<void>(`/groups/${id}`, { method: "DELETE" }),
    setOrder: (id: string, req: SetGroupOrderRequest) =>
      request<void>(`/groups/${id}/order`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      }),
    assignContainer: (groupId: string, req: AssignContainerRequest) =>
      request<void>(`/groups/${groupId}/containers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      }),
    unassignContainer: (groupId: string, containerId: string) =>
      request<void>(`/groups/${groupId}/containers/${containerId}`, { method: "DELETE" }),
    startAll: (id: string) => request<void>(`/groups/${id}/start`, { method: "POST" }),
    stopAll: (id: string) => request<void>(`/groups/${id}/stop`, { method: "POST" }),
    setDisplayOrder: (groupIds: string[]) =>
      request<void>("/groups/display-order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_ids: groupIds }),
      }),
  },
  compose: {
    list: () => request<ComposeProject[]>("/compose"),
    inspect: (name: string) => request<ComposeProject>(`/compose/${name}`),
    getFile: (name: string) => request<ComposeFileContent>(`/compose/${name}/file`),
    saveFile: (name: string, content: string) =>
      request<void>(`/compose/${name}/file`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }),
    create: (name: string, content: string, workingDir?: string) =>
      request<ComposeProject>("/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, content, ...(workingDir ? { working_dir: workingDir } : {}) }),
      }),
    remove: (name: string) => request<void>(`/compose/${name}`, { method: "DELETE" }),
    validate: (content: string) =>
      request<ValidateResult>("/compose/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }),
    upWsUrl: (name: string) => wsUrl(`/compose/${name}/up`),
    downWsUrl: (name: string) => wsUrl(`/compose/${name}/down`),
    restartWsUrl: (name: string) => wsUrl(`/compose/${name}/restart`),
    pullWsUrl: (name: string) => wsUrl(`/compose/${name}/pull`),
    logsWsUrl: (name: string) => wsUrl(`/compose/${name}/logs`),
  },

  events: {
    wsUrl: () => wsUrl("/events"),
  },

  health: {
    get: () => request<HealthStatus>("/health"),
  },

  info: {
    get: () => request<AppInfo>("/info"),
    getComposeDirs: () => request<{ dirs: string[] }>("/settings/compose-dirs"),
    setComposeDirs: (dirs: string[]) =>
      request<void>("/settings/compose-dirs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dirs }),
      }),
    setPodmanSocket: (socket: string) =>
      request<void>("/settings/podman-socket", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socket }),
      }),
  },
};
