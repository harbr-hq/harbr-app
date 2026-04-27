# Harbr

**A native container manager built for developers who use Podman.**
No forced sign-ins. No Electron. No bloat. Just a fast desktop app that stays out of your way.

![CI](https://github.com/harbr-hq/harbr/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows-lightgrey)

---

## Demos

### Container Demo

<video src="https://github.com/user-attachments/assets/2ad517cb-ef77-4aa1-ab60-493a8587db21" controls width="100%"></video>

### Compose Demo

<video src="https://github.com/user-attachments/assets/d6999403-ef09-45f4-aca0-62a85f6f0a1a" controls width="100%"></video>

### Misc Demo

<video src="https://github.com/user-attachments/assets/0cb3dc36-2ef3-44c1-af74-1b732c7f3150" controls width="100%"></video>

---

## Quick Start

> Requires: Rust stable, Node.js 22+, pnpm 10+, Podman. See [building from source](#building-from-source) for full setup.

```bash
# Linux — enable Podman socket and install compose
systemctl --user enable --now podman.socket
pip install podman-compose

# Clone, install, build, run
git clone https://github.com/harbr-hq/harbr
cd harbr && pnpm install && pnpm tauri build
./src-tauri/target/release/harbr
```

**macOS / Windows:** see [macos/](macos/) and [windows/](windows/) for guided setup scripts.

---

## Try It Out

Once Harbr is running, here are two ways to kick the tyres.

### Option A — Spin up a Compose stack

Save this as `~/compose/demo/compose.yaml`:

```yaml
services:
  web:
    image: docker.io/library/nginx:alpine
    ports:
      - "8080:80"

  api:
    image: docker.io/library/node:22-alpine
    working_dir: /app
    command: sh -c "node -e \"const h=require('http');h.createServer((_,r)=>{r.writeHead(200);r.end('Hello from Harbr demo API')}).listen(3000)\""
    ports:
      - "3000:3000"

  db:
    image: docker.io/library/postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: demo
      POSTGRES_DB: harbr_demo
    volumes:
      - pgdata:/var/lib/postgresql/data

  cache:
    image: docker.io/library/redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

Then in Harbr:

1. Open **Preferences** (sidebar footer) → **Compose Directories** → add `~/compose`
2. Click **Compose** in the sidebar — the `demo` project appears automatically
3. Click into the project → hit **Up** → watch all four containers stream to life in real time
4. Switch to **Containers** — you'll see them all running with live CPU and memory bars
5. Click any container → **Logs** for live output, **Terminal** to drop into a shell

### Option B — Run a single container

1. In **Containers**, click **Run Container** (top-right button)
2. Image: `docker.io/library/nginx:alpine`
3. Name: `my-nginx`
4. Add a port mapping: host `8080` → container `80`
5. Hit **Run** — the container appears in the list immediately
6. Click it → **Logs** to see nginx startup output, or **Terminal** to explore the filesystem

> **Note:** Podman requires fully-qualified image names — `docker.io/library/nginx:alpine` not just `nginx`. Harbr's Run Container sheet will remind you if the pull fails.

---

> ### 📖 Not sure where to start?
> **Hit Help in the sidebar.** Every feature has its own documentation page with screenshots. Type anything into the search box at the top of the Help sidebar and results jump straight to the relevant section — no browser, no Googling, no leaving the app.

---

## Why Harbr

Docker Desktop is slow, requires a sign-in, and doesn't feel native. Rancher Desktop is clunky.
Neither was built with developer experience as a first principle.

Harbr is different:

- **Podman** — daemonless, rootless by default, OCI-compliant, fully Docker API compatible
- **Native desktop app** — Tauri v2, not Electron, not a web app wrapped in Chrome
- **No forced accounts** — auth via bearer token, you control the token
- **Persistent log search** — full-text search across all containers, not just tailing the last 100 lines
- **Single binary** — desktop app and daemon in one, no separate installer

---

## Features

### Container Management
- Live container list with status indicators (animated pulse dot for running containers)
- Start, stop, pause, unpause, and remove containers
- Inline CPU and memory usage bars in the list view
- Port mappings at a glance
- Bulk start / stop across multiple containers
- Search and filter by name, running-only toggle
- Run container with port mapping, environment variables, and command override
- Grouped view — containers grouped by Compose project or custom group, with drag-and-drop reorder
- Copy container ID from the list

### Logs
- Live log streaming via WebSocket
- Pause / resume with buffered catch-up (up to 1000 lines held while paused)
- Wildcard filter (`*` and `?`) applied client-side in real time — no reconnect needed
- Highlighted matches in the log output
- `stdout` / `stderr` colour coding

### Insights (per container)
- Live CPU and memory area charts, seeded immediately on open
- Persistent logging toggle — opt individual containers into log storage
- Retention policy: by disk size (MB) or by age (days)

### Cross-Container Log Search
The headline feature. Once persistent logging is enabled for a container, every log line is stored locally and becomes searchable.

- Full-text search across all containers simultaneously
- Filter by container (coloured token chips — add and remove individually)
- Filter by stream (`stdout` / `stderr`)
- Time range presets: 1h, 6h, 24h, 7d, or all time
- Results show container, stream, timestamp, and highlighted matching line
- Paginated load more — no artificial result caps
- Filter state persists in the URL

### Terminal
- Full interactive terminal into any running container
- Powered by xterm.js v6
- Session persists across tab switches

### Compose
- Project discovery — scans configured directories and pulls in Podman-label-tracked projects
- YAML editor with syntax highlighting and validation (CodeMirror 6)
- Streaming output for `up`, `down`, `restart`, and `pull` operations
- Fan-in log view across all services in a project
- File management — view and edit compose files in the UI

### Images / Volumes / Networks
- List, inspect, and remove images, volumes, and networks
- Container membership view for networks
- Volume usage and file browser

### System Tray
- Daemon health indicator
- Container and Compose actions from the tray menu
- Crash notifications when a running container exits unexpectedly
- Close-to-tray preference

### Built-In Documentation
- Searchable help covering every feature, with screenshots
- Type any term in the search box — results link directly to the relevant heading
- Troubleshooting guide for common Podman and Compose errors

### Everything Else
- Light / dark / system theme
- Collapsible sidebar (icon rail with tooltips when collapsed)
- Bearer token auth — loopback connections bypass auth automatically
- Layered config: system → user → environment variables → CLI flags

---

## Tech Stack

### Desktop Shell

| Library | Version | Purpose |
|---|---|---|
| [Tauri](https://tauri.app) | v2 | Native desktop shell — Rust backend, WebView frontend, no Electron |
| [React](https://react.dev) | 19 | UI framework |
| [TypeScript](https://www.typescriptlang.org) | 5.8 | Type safety across the entire frontend |
| [Vite](https://vitejs.dev) | 7 | Frontend build tool and dev server |

### Frontend

| Library | Version | Purpose |
|---|---|---|
| [TanStack Router](https://tanstack.com/router) | v1 | File-based routing with type-safe search params |
| [TanStack Query](https://tanstack.com/query) | v5 | Server state, caching, and background refetching |
| [Tailwind CSS](https://tailwindcss.com) | v4 | Utility-first styling |
| [shadcn/ui](https://ui.shadcn.com) | — | Accessible component primitives (Radix UI based) |
| [xterm.js](https://xtermjs.org) | v5 | In-app container terminal |
| [CodeMirror](https://codemirror.net) | v6 | YAML editor for Compose files |
| [date-fns](https://date-fns.org) | v4 | Date formatting |
| [Sonner](https://sonner.emilkowal.ski) | v2 | Toast notifications |
| [Lucide React](https://lucide.dev) | — | Icon set |
| [dnd kit](https://dndkit.com) | v6 | Drag-and-drop for container group reordering |
| [Recharts](https://recharts.org) | v2 | CPU and memory area charts |

### Backend (Rust)

| Crate | Version | Purpose |
|---|---|---|
| [Axum](https://github.com/tokio-rs/axum) | 0.8 | HTTP and WebSocket server |
| [Tokio](https://tokio.rs) | 1 | Async runtime |
| [Bollard](https://github.com/fussybeaver/bollard) | 0.20 | Podman/Docker API client |
| [SurrealDB](https://surrealdb.com) | 3 | Embedded local database (log storage, settings, groups) |
| [Figment](https://github.com/SergioBenitez/Figment) | 0.10 | Layered configuration (TOML → env → CLI) |
| [Clap](https://github.com/clap-rs/clap) | 4 | CLI argument parsing |
| [Anyhow](https://github.com/dtolnay/anyhow) | 1 | Error handling |
| [Serde](https://serde.rs) | 1 | Serialisation/deserialisation |
| [Tracing](https://github.com/tokio-rs/tracing) | 0.1 | Structured logging |

---

## Building from Source

There are no pre-built binaries. You'll need to build from source.

> **Disk space:** Allow at least 20 GB. Rust's dependency cache and Tauri build artifacts are the main culprits. Run `./clean.sh` to recover space after a build.

### Linux

```bash
# Enable Podman user socket
systemctl --user enable --now podman.socket

# Install podman-compose (Podman 5.x ships without a compose backend)
pip install podman-compose

# Install dependencies and build
pnpm install
pnpm tauri build
```

The daemon binds to `127.0.0.1:9090` on startup.
Auth token is generated at `~/.config/harbr/token` on first run.

### macOS

See [docs/building-on-macos.md](docs/building-on-macos.md) for the full guide, or use the scripts in [`macos/`](macos/):

```bash
cd macos
chmod +x Step1-Prerequisites.sh Step2-Build.sh
./Step1-Prerequisites.sh
./Step2-Build.sh
```

### Windows

See [docs/building-on-windows.md](docs/building-on-windows.md) for the full guide, or use the scripts in [`windows/`](windows/):

```powershell
cd windows
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\Step1-Prerequisites.ps1   # run as Admin
.\Step2-Build.ps1
```

---

## Configuration

Layered config — each level overrides the previous:

1. `/etc/harbr/config.toml` — system-wide
2. `~/.config/harbr/config.toml` — user
3. `HARBR_*` environment variables
4. `--config /path/to/config.toml` CLI flag

```toml
[server]
host = "127.0.0.1"
port = 9090

[auth]
enabled = true
token_file = "~/.config/harbr/token"

[podman]
socket = "/run/user/1000/podman/podman.sock"

[logging]
level = "info"
```

---

## Built-In Help

Harbr ships with full documentation baked into the app — no browser required.

Click **Help** in the sidebar to open the docs. A **search box at the top** lets you type any term — feature name, error message, config key — and get an instant list of matching entries. Click a result and the app navigates directly to that section and scrolls to the relevant heading. Each section also includes **screenshots** so you can orient yourself quickly.

**Covered in full:**
- Containers — list view, status indicators, grouped view, running a container
- Logs — live streaming, pause/resume, filtering, `stdout`/`stderr` colour coding
- Log Search — enabling persistence, full-text search, filters, time ranges
- Insights — CPU/memory charts, retention policies, restart policy
- Terminal — opening a shell, session persistence
- Compose — project discovery, YAML editor, up/down/restart, log fan-in, restart policy
- Images, Volumes, Networks — browsing, inspecting, removing
- Preferences — compose directories, close-to-tray, auth token
- Troubleshooting — Podman socket, image name format, common errors

If you're new to Podman or just new to Harbr, Help is the right place to start.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Licence

[MIT](LICENSE)
