export interface HelpEntry {
  sectionId: string;
  sectionLabel: string;
  heading: string;
  /** Short description shown in search results. */
  excerpt: string;
  /** Additional space-separated keywords not in heading/excerpt. */
  keywords: string;
}

export const helpIndex: HelpEntry[] = [
  // ── Getting Started ────────────────────────────────────────────────────────
  {
    sectionId: "getting-started",
    sectionLabel: "Getting Started",
    heading: "What is Harbr?",
    excerpt: "Native desktop app for managing containers using Podman — no Docker account required.",
    keywords: "overview introduction podman docker alternative rootless",
  },
  {
    sectionId: "getting-started",
    sectionLabel: "Getting Started",
    heading: "Prerequisites",
    excerpt: "Harbr requires Podman installed and the socket enabled. Also needs podman-compose for Compose features.",
    keywords: "install setup podman socket systemctl brew winget podman-compose pip",
  },
  {
    sectionId: "getting-started",
    sectionLabel: "Getting Started",
    heading: "First Run",
    excerpt: "On first launch Harbr generates a bearer token, starts the daemon on port 9090, and connects to Podman.",
    keywords: "startup launch token auth bearer daemon port 9090 surrealdb database",
  },
  {
    sectionId: "getting-started",
    sectionLabel: "Getting Started",
    heading: "The Dashboard",
    excerpt: "Stat cards, running containers, aggregate resource graph (CPU + memory), activity feed, and Compose project cards.",
    keywords: "dashboard overview stat cards resource graph cpu memory aggregate activity feed compose projects running",
  },
  {
    sectionId: "getting-started",
    sectionLabel: "Getting Started",
    heading: "Config File",
    excerpt: "Configuration is read from a TOML file. Location varies by platform — Linux, macOS, Windows.",
    keywords: "config configuration toml file path linux macos windows appdata",
  },

  // ── Containers ─────────────────────────────────────────────────────────────
  {
    sectionId: "containers",
    sectionLabel: "Containers",
    heading: "The Container List",
    excerpt: "All containers are listed with status, image, ports, and resource usage at a glance.",
    keywords: "list overview containers running stopped exited paused cpu memory",
  },
  {
    sectionId: "containers",
    sectionLabel: "Containers",
    heading: "Status Indicators",
    excerpt: "Colour-coded status dots — green running, amber paused, grey stopped, red exited.",
    keywords: "status running stopped paused exited badge colour indicator",
  },
  {
    sectionId: "containers",
    sectionLabel: "Containers",
    heading: "Search & Filter",
    excerpt: "Filter containers by name or image using the search box. Click × to clear. Port conflict warning appears when two running containers share a host port.",
    keywords: "search filter name image running only toggle clear x port conflict warning",
  },
  {
    sectionId: "containers",
    sectionLabel: "Containers",
    heading: "Container Actions",
    excerpt: "Start, stop, pause, unpause, remove, and move containers from the row actions or context menu.",
    keywords: "start stop pause unpause remove delete context menu three dot actions move to group",
  },
  {
    sectionId: "containers",
    sectionLabel: "Containers",
    heading: "Move to Group",
    excerpt: "Reassign a container to a different group from the ⋯ context menu — no dragging required. Includes an Ungrouped option to remove from a group.",
    keywords: "move to group reassign assign ungrouped transfer context menu no drag",
  },
  {
    sectionId: "containers",
    sectionLabel: "Containers",
    heading: "Copying a Container ID",
    excerpt: "Click the short ID in the container row to copy it to the clipboard.",
    keywords: "copy id clipboard short id",
  },
  {
    sectionId: "containers",
    sectionLabel: "Containers",
    heading: "Running a New Container",
    excerpt: "Use the Run Container sheet to start a container from an image with port mappings, env vars, and a command override.",
    keywords: "run new container image ports env environment variables command create start",
  },
  {
    sectionId: "containers",
    sectionLabel: "Containers",
    heading: "Grouped vs Flat View",
    excerpt: "Toggle between a flat list and a grouped view that organises containers by Compose project or custom group.",
    keywords: "groups grouped flat view layers toggle compose project custom",
  },
  {
    sectionId: "containers",
    sectionLabel: "Containers",
    heading: "Custom Groups",
    excerpt: "Create named groups to organise standalone containers. New groups appear at the top. Assign containers by dragging or using the context menu.",
    keywords: "custom group create rename colour assign top new",
  },
  {
    sectionId: "containers",
    sectionLabel: "Containers",
    heading: "Reordering Groups",
    excerpt: "Drag group headers to reorder them in the list. The order is persisted.",
    keywords: "reorder drag drop order groups",
  },
  {
    sectionId: "containers",
    sectionLabel: "Containers",
    heading: "Dragging Containers",
    excerpt: "Drag a container row into a different group to reassign it.",
    keywords: "drag drop move assign group dnd",
  },
  {
    sectionId: "containers",
    sectionLabel: "Containers",
    heading: "Bulk Actions",
    excerpt: "Select multiple containers and start or stop them all at once.",
    keywords: "bulk select multiple start stop all at once batch",
  },

  // ── Container Detail ───────────────────────────────────────────────────────
  {
    sectionId: "container-detail",
    sectionLabel: "Container Detail",
    heading: "Log Viewer",
    excerpt: "Stream live logs with pause/resume, text filter, and highlight. Status indicator shows Not running, Connecting, or Streaming. Back button returns to containers or compose.",
    keywords: "logs stream live filter highlight pause resume buffer status not running connecting streaming back navigate compose",
  },
  {
    sectionId: "container-detail",
    sectionLabel: "Container Detail",
    heading: "Insights Tab",
    excerpt: "Live CPU and memory charts, persistent log settings, and restart policy configuration.",
    keywords: "insights stats cpu memory charts persistent logs retention restart policy",
  },
  {
    sectionId: "container-detail",
    sectionLabel: "Container Detail",
    heading: "Terminal Tab",
    excerpt: "Open an interactive terminal session inside the running container via WebSocket.",
    keywords: "terminal exec shell interactive session pty websocket",
  },
  {
    sectionId: "container-detail",
    sectionLabel: "Container Detail",
    heading: "Restart Policy",
    excerpt: "Set the container restart policy (no, on-failure, unless-stopped, always). Requires Podman 5.0+.",
    keywords: "restart policy always unless-stopped on-failure no reboot survive podman 5 loginctl linger",
  },

  // ── Compose ────────────────────────────────────────────────────────────────
  {
    sectionId: "compose",
    sectionLabel: "Compose",
    heading: "Creating a New Project",
    excerpt: "New project sheet — project name, working directory (type or browse, validated), YAML editor with live validation, and Format on create option.",
    keywords: "new project create sheet working directory bind mount relative path nginx.conf config files -p project name override browse validate format on create yaml invalid disabled",
  },
  {
    sectionId: "compose",
    sectionLabel: "Compose",
    heading: "Project Discovery",
    excerpt: "Harbr discovers Compose projects from Podman container labels and configured compose directories.",
    keywords: "discover projects labels directories scan compose.yaml docker-compose.yml",
  },
  {
    sectionId: "compose",
    sectionLabel: "Compose",
    heading: "The Project List",
    excerpt: "Projects show as Running, Partial, Stopped, or File Only based on the state of their services.",
    keywords: "project list status running partial stopped file only",
  },
  {
    sectionId: "compose",
    sectionLabel: "Compose",
    heading: "Services Tab",
    excerpt: "Per-service status, image, and ports. Restart individual services from here.",
    keywords: "services status image ports restart service",
  },
  {
    sectionId: "compose",
    sectionLabel: "Compose",
    heading: "File Tab",
    excerpt: "Edit compose YAML in a CodeMirror editor. Format, validate, copy to clipboard, and save. Shows working directory path when set.",
    keywords: "file editor yaml codemirror syntax highlight validation edit save format copy clipboard indent working directory bind mount",
  },
  {
    sectionId: "compose",
    sectionLabel: "Compose",
    heading: "Running Compose Operations",
    excerpt: "Up, down, restart, and pull operations with live streaming output.",
    keywords: "up down restart pull operation stream output",
  },
  {
    sectionId: "compose",
    sectionLabel: "Compose",
    heading: "Compose Groups in the Containers Tab",
    excerpt: "Compose groups only appear in the Containers tab when at least one container exists. compose down removes containers; compose stop leaves them as exited.",
    keywords: "containers tab group grouped view down stop exited removed reboot missing not showing compose down stop disappear",
  },
  {
    sectionId: "compose",
    sectionLabel: "Compose",
    heading: "Logs Tab",
    excerpt: "Fan-in log stream from all services simultaneously. Status indicator shows Not running, Connecting, or Streaming. Auto-reconnects when the project starts.",
    keywords: "logs all services fan-in stream combined status indicator reconnect amber green streaming",
  },
  {
    sectionId: "compose",
    sectionLabel: "Compose",
    heading: "Restart Policy",
    excerpt: "Set restart: in the compose file for each service. Requires force-recreate to apply.",
    keywords: "restart policy compose file always unless-stopped on-failure no force-recreate reboot linger loginctl",
  },

  // ── Log Search ─────────────────────────────────────────────────────────────
  {
    sectionId: "log-search",
    sectionLabel: "Log Search",
    heading: "Searching",
    excerpt: "Full-text search across all stored container logs. Enable persistent logging per-container first.",
    keywords: "search logs full text fts query stored persistent",
  },
  {
    sectionId: "log-search",
    sectionLabel: "Log Search",
    heading: "Container Filter",
    excerpt: "Only containers with stored logs appear in the picker. Filter to one or more using coloured chips.",
    keywords: "container filter chip select token colour stored logs persistent has logs",
  },
  {
    sectionId: "log-search",
    sectionLabel: "Log Search",
    heading: "Time Presets",
    excerpt: "Quickly restrict results to the last 15m, 1h, 6h, 24h, or 7 days.",
    keywords: "time preset range last 15 minutes hour day week",
  },
  {
    sectionId: "log-search",
    sectionLabel: "Log Search",
    heading: "Stream Filter",
    excerpt: "Filter by stdout, stderr, or show both.",
    keywords: "stream stdout stderr filter",
  },
  {
    sectionId: "log-search",
    sectionLabel: "Log Search",
    heading: "Load More",
    excerpt: "Results are paginated — click Load More to fetch additional matches.",
    keywords: "pagination load more results offset",
  },
  {
    sectionId: "log-search",
    sectionLabel: "Log Search",
    heading: "URL State",
    excerpt: "Search query, filters, and time range are stored in the URL — share or bookmark searches.",
    keywords: "url state bookmark share params persistent query",
  },

  // ── Images ─────────────────────────────────────────────────────────────────
  {
    sectionId: "images",
    sectionLabel: "Images",
    heading: "Image List",
    excerpt: "All local images with repo tags, size, creation date, and container usage count.",
    keywords: "images list tags size created containers",
  },
  {
    sectionId: "images",
    sectionLabel: "Images",
    heading: "Removing Images",
    excerpt: "Remove individual images. Force-remove to delete images that have stopped containers.",
    keywords: "remove delete image force",
  },
  {
    sectionId: "images",
    sectionLabel: "Images",
    heading: "Prune",
    excerpt: "Remove all unused (dangling) images in one go to reclaim disk space.",
    keywords: "prune unused dangling disk space reclaim cleanup",
  },

  // ── Volumes ────────────────────────────────────────────────────────────────
  {
    sectionId: "volumes",
    sectionLabel: "Volumes",
    heading: "Volume List",
    excerpt: "All named volumes with driver, mountpoint, size, and container reference count.",
    keywords: "volumes list driver mountpoint size ref count",
  },
  {
    sectionId: "volumes",
    sectionLabel: "Volumes",
    heading: "File Browser",
    excerpt: "Browse files inside a volume without shelling out — navigate directories and inspect file metadata.",
    keywords: "file browser browse volume directory files metadata",
  },
  {
    sectionId: "volumes",
    sectionLabel: "Volumes",
    heading: "Container Membership",
    excerpt: "See which containers are currently using a volume.",
    keywords: "containers using volume mounted membership",
  },
  {
    sectionId: "volumes",
    sectionLabel: "Volumes",
    heading: "Removing Volumes",
    excerpt: "Remove a volume. Only possible when no containers are using it.",
    keywords: "remove delete volume",
  },
  {
    sectionId: "volumes",
    sectionLabel: "Volumes",
    heading: "Prune",
    excerpt: "Remove all volumes not referenced by any container.",
    keywords: "prune unused volumes cleanup disk",
  },

  // ── Networks ───────────────────────────────────────────────────────────────
  {
    sectionId: "networks",
    sectionLabel: "Networks",
    heading: "Network List",
    excerpt: "All networks with driver, subnet, gateway, and connected container count.",
    keywords: "networks list driver subnet gateway containers bridge",
  },
  {
    sectionId: "networks",
    sectionLabel: "Networks",
    heading: "Container Membership",
    excerpt: "Expand a network to see which containers are connected and their IP addresses.",
    keywords: "containers connected ip address network membership",
  },
  {
    sectionId: "networks",
    sectionLabel: "Networks",
    heading: "Removing Networks",
    excerpt: "Remove a network. Only possible when no containers are connected to it.",
    keywords: "remove delete network",
  },
  {
    sectionId: "networks",
    sectionLabel: "Networks",
    heading: "Prune",
    excerpt: "Remove all networks not in use by any container.",
    keywords: "prune unused networks cleanup",
  },

  // ── Preferences ───────────────────────────────────────────────────────────
  {
    sectionId: "preferences",
    sectionLabel: "Preferences",
    heading: "Compose Directories",
    excerpt: "Configure which directories Harbr scans for compose files.",
    keywords: "compose directories scan config paths folders",
  },
  {
    sectionId: "preferences",
    sectionLabel: "Preferences",
    heading: "Podman Socket",
    excerpt: "Override the Podman socket path if Harbr can't find it automatically.",
    keywords: "podman socket path override xdg runtime custom",
  },
  {
    sectionId: "preferences",
    sectionLabel: "Preferences",
    heading: "System Tray",
    excerpt: "Tray icon actions — start, stop, restart containers, run compose operations, and copy ports without opening the window.",
    keywords: "tray icon menu containers start stop restart compose up down port copy clipboard actions",
  },
  {
    sectionId: "preferences",
    sectionLabel: "Preferences",
    heading: "Tray Notifications",
    excerpt: "OS notifications confirm the result of tray actions — started, stopped, restarted, or failed with a reason.",
    keywords: "notification notify-send tray action result success failure error compose container started stopped restarted",
  },
  {
    sectionId: "preferences",
    sectionLabel: "Preferences",
    heading: "Close to Tray",
    excerpt: "Keep Harbr running in the system tray when the window is closed.",
    keywords: "tray close minimise system tray background",
  },
  {
    sectionId: "preferences",
    sectionLabel: "Preferences",
    heading: "Theme",
    excerpt: "Switch between light and dark mode.",
    keywords: "theme dark light mode colour scheme",
  },
  {
    sectionId: "preferences",
    sectionLabel: "Preferences",
    heading: "Clearing stored log data",
    excerpt: "Delete all persistently stored log entries from the local database.",
    keywords: "clear logs delete stored database reset",
  },
  {
    sectionId: "preferences",
    sectionLabel: "Preferences",
    heading: "System Info",
    excerpt: "View app version, Podman version, socket path, compose binary, and data directory.",
    keywords: "version info podman app system socket compose data directory",
  },

  // ── Troubleshooting ────────────────────────────────────────────────────────
  {
    sectionId: "troubleshooting",
    sectionLabel: "Troubleshooting",
    heading: "Daemon shows as offline",
    excerpt: "The Podman socket is not reachable. Start the socket service and check the path in Preferences.",
    keywords: "offline daemon podman socket unreachable disconnected status",
  },
  {
    sectionId: "troubleshooting",
    sectionLabel: "Troubleshooting",
    heading: "Terminal tab won't connect",
    excerpt: "The terminal requires the container to be running. Check container status and WebSocket connectivity.",
    keywords: "terminal connect websocket error not working",
  },
  {
    sectionId: "troubleshooting",
    sectionLabel: "Troubleshooting",
    heading: "Log Search returns no results",
    excerpt: "Persistent logging must be enabled per-container in the Insights tab before logs are stored.",
    keywords: "log search no results empty persistent logging not enabled insights",
  },
  {
    sectionId: "troubleshooting",
    sectionLabel: "Troubleshooting",
    heading: "Compose Up fails immediately",
    excerpt: "Usually a missing image, port conflict, or malformed compose file. Check the output panel for details.",
    keywords: "compose up fails error image port conflict malformed yaml",
  },
  {
    sectionId: "troubleshooting",
    sectionLabel: "Troubleshooting",
    heading: "\"No compose binary available\"",
    excerpt: "podman-compose or docker compose is not installed or not on PATH.",
    keywords: "compose binary missing not found path podman-compose docker compose install",
  },
  {
    sectionId: "troubleshooting",
    sectionLabel: "Troubleshooting",
    heading: "Linux — containers stopped after reboot",
    excerpt: "Use restart: always (not unless-stopped), enable loginctl linger, and enable podman-restart.service for containers to auto-start at boot.",
    keywords: "reboot restart stopped containers linux linger loginctl podman-restart.service systemd user session always",
  },
  {
    sectionId: "troubleshooting",
    sectionLabel: "Troubleshooting",
    heading: "macOS — can't connect after reboot",
    excerpt: "The Podman machine needs to be started manually after a reboot: podman machine start.",
    keywords: "macos reboot restart podman machine start reconnect",
  },
  {
    sectionId: "troubleshooting",
    sectionLabel: "Troubleshooting",
    heading: "Windows — wrong socket path",
    excerpt: "On Windows the Podman socket path differs from Linux. Update it in Preferences → Podman Socket.",
    keywords: "windows socket path wrong podman machine npipe",
  },
];
