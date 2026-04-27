# Harbr — Architecture & Implementation Reference

This document describes how Harbr is structured, how its subsystems work, and
the reasoning behind key decisions. It is intended for developers contributing
to or reading the source code. It grows as the project does.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Project Structure](#project-structure)
4. [Daemon](#daemon)
5. [Config System](#config-system)
6. [Auth System](#auth-system)
7. [REST API](#rest-api)
8. [WebSocket API](#websocket-api)
9. [Frontend Architecture](#frontend-architecture)
10. [Real-Time Data](#real-time-data)
11. [Container Terminal](#container-terminal)
12. [UI State Transitions](#ui-state-transitions)
13. [Key Patterns](#key-patterns)
14. [Development Conventions](#development-conventions)
15. [Roadmap](#roadmap)

---

## Overview

Harbr is a single Rust binary that operates in two modes:

- **Desktop mode** (default): Tauri opens a native window embedding a React frontend. The Rust
  daemon runs in the background as an Axum HTTP/WebSocket server.
- **Headless mode** *(planned)*: daemon only — no window. Useful for running on a remote server
  and connecting the UI from another machine.

The frontend **always** communicates with the backend via HTTP/WebSocket — never directly with
Podman. This means the same UI can manage a local daemon or a remote one over a network.

---

## Architecture Diagram

```
┌──────────────────────────────────────┐
│  Tauri Shell (desktop)               │
│  or Browser (remote — planned)       │
│                                      │
│  React 19 + TanStack Router/Query    │
│  shadcn/ui + Tailwind v4             │
│  xterm.js (terminal)                 │
└───────────────┬──────────────────────┘
                │ HTTP REST + WebSocket
                │ Authorization: Bearer <token>
┌───────────────▼──────────────────────┐
│  Rust / Axum daemon                  │
│  127.0.0.1:9090                      │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  Auth middleware               │  │
│  │  Bearer token / ?token= param  │  │
│  └───────────────┬────────────────┘  │
│                  │                   │
│  ┌───────────────▼────────────────┐  │
│  │  Route handlers                │  │
│  │  containers / logs / stats /   │  │
│  │  terminal (exec)               │  │
│  └───────────────┬────────────────┘  │
│                  │                   │
│  ┌───────────────▼────────────────┐  │
│  │  bollard Docker/Podman client  │  │
│  └───────────────┬────────────────┘  │
└──────────────────┼───────────────────┘
                   │ Unix socket
┌──────────────────▼───────────────────┐
│  Podman                              │
│  $XDG_RUNTIME_DIR/podman/podman.sock │
└──────────────────────────────────────┘
```

---

## Project Structure

```
harbr/
├── src/                            # React/TypeScript frontend
│   ├── components/
│   │   ├── ui/                     # shadcn/ui components (generated, don't hand-edit)
│   │   ├── app-sidebar.tsx         # Main nav sidebar
│   │   ├── mode-toggle.tsx         # Light/dark/system theme toggle
│   │   └── terminal-panel.tsx      # xterm.js terminal component
│   ├── hooks/
│   │   ├── use-container-logs.ts   # WebSocket hook — log streaming
│   │   ├── use-container-stats.ts  # WebSocket hook — CPU/memory stats
│   │   └── use-min-pending.ts      # UI helper — minimum pending duration
│   ├── lib/
│   │   └── api.ts                  # Typed API client, auth token, wsUrl()
│   ├── routes/                     # TanStack Router file-based routes
│   │   ├── __root.tsx              # Root layout (sidebar, theme provider)
│   │   ├── index.tsx               # Redirect → /containers
│   │   ├── containers.tsx          # Layout route for /containers/*
│   │   ├── containers.index.tsx    # Container list page
│   │   └── containers.$id.tsx      # Container detail page
│   ├── index.css                   # Tailwind + CSS variable theming
│   └── main.tsx                    # Entry point — bootstraps auth then renders
│
├── src-tauri/
│   ├── src/
│   │   ├── main.rs                 # Tauri entry point (don't touch)
│   │   ├── lib.rs                  # run() — loads config, token, starts daemon
│   │   ├── config/
│   │   │   └── mod.rs              # AppConfig struct + Figment loading
│   │   └── daemon/
│   │       ├── mod.rs              # AppState, start()
│   │       ├── auth.rs             # Token file management + Axum middleware
│   │       └── routes/
│   │           ├── mod.rs          # Router assembly + auth middleware wiring
│   │           ├── containers.rs   # REST: list, start, stop
│   │           ├── logs.rs         # WebSocket: log streaming
│   │           ├── stats.rs        # WebSocket: CPU/memory stats
│   │           └── terminal.rs     # WebSocket: exec/PTY bridge
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── docs/
│   └── ARCHITECTURE.md             # This file
├── README.md
├── vite.config.ts
└── package.json
```

---

## Daemon

**Entry point:** `lib.rs` → `run()`

On startup:
1. Config is loaded via Figment (see [Config System](#config-system))
2. Auth token is loaded or generated (see [Auth System](#auth-system))
3. The token is registered with Tauri's state system so the frontend can fetch it via IPC
4. `daemon::start(config, token)` is spawned as a background async task
5. Tauri opens the desktop window

**`daemon::start()`** (`daemon/mod.rs`):
1. Connects to the Podman Unix socket via `bollard`
2. Pings the socket — fails fast if Podman isn't running
3. Builds `AppState { podman, token, auth_enabled }`
4. Binds a `TcpListener` and hands it to `axum::serve`

`AppState` is `Clone` and injected into every route handler via Axum's `State` extractor.

---

## Config System

**File:** `src-tauri/src/config/mod.rs`

Config is loaded with [Figment](https://docs.rs/figment) using this priority order
(each layer overrides the previous):

| Priority | Source |
|---|---|
| 1 (lowest) | Built-in defaults (compiled in) |
| 2 | `/etc/harbr/config.toml` (system-wide, sysadmin) |
| 3 | `~/.config/harbr/config.toml` (user) |
| 4 | `HARBR_*` environment variables |
| 5 (highest) | `--config /path/to/file` CLI flag *(planned)* |

**`AppConfig` shape:**

```toml
[server]
host = "127.0.0.1"
port = 9090

[auth]
enabled = true
token_file = "~/.config/harbr/token"   # resolved at runtime via dirs::config_dir()

[podman]
socket = "$XDG_RUNTIME_DIR/podman/podman.sock"   # resolved at runtime

[logging]
level = "info"
```

**Environment variable mapping:**
Figment maps `HARBR_SERVER_PORT=9091` → `server.port = 9091` via `Env::prefixed("HARBR_").split("_")`.

**`dirs::config_dir()`** resolves to:
- Linux: `$XDG_CONFIG_HOME` or `~/.config`
- macOS: `~/Library/Application Support`
- Windows: `%APPDATA%`

---

## Auth System

**File:** `src-tauri/src/daemon/auth.rs`

### Token generation

On first run, `load_or_create_token()`:
1. Checks whether the token file exists and is non-empty
2. If not, generates 32 random bytes via `rand::rngs::OsRng` (cryptographically secure)
3. Encodes as 64-char lowercase hex (URL-safe, no padding needed)
4. Writes to the token file with `0600` permissions (owner read/write only on Unix)

The token file location defaults to `~/.config/harbr/token` and is configurable via `auth.token_file`.

### Axum middleware

`auth::require_auth` is applied to the entire `/api/v1` tree via
`axum::middleware::from_fn_with_state`.

It accepts the token in two places:

| Method | Where | Used by |
|---|---|---|
| `Authorization: Bearer <token>` | HTTP header | All REST calls |
| `?token=<token>` | URL query param | WebSocket connections (can't set headers) |

Returns `401 Unauthorized` with `{"error": "Unauthorized"}` if the token is missing or wrong.
Auth can be disabled via `auth.enabled = false` in config (development convenience only).

### Frontend token delivery

Tauri exposes a `get_token` IPC command (registered in `lib.rs`).
`main.tsx` calls `invoke("get_token")` before React mounts and passes the token to `setApiToken()`
in `api.ts`. From that point, all `fetch` calls and WebSocket URLs are automatically authenticated.

If `invoke` fails (running in a plain browser without Tauri), the app still renders — useful for
frontend layout development without the full Tauri stack.

---

## REST API

Base URL: `http://localhost:9090/api/v1`

All endpoints require `Authorization: Bearer <token>`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/containers` | List all containers with status |
| `POST` | `/containers/:id/start` | Start a container |
| `POST` | `/containers/:id/stop` | Stop a container |

**Container object:**
```json
{
  "id": "abc123def456",
  "name": "my-nginx",
  "image": "docker.io/library/nginx:latest",
  "status": "running",
  "created": 1709123456
}
```

**Status values:** `running` | `stopped` | `paused` | `exited` | `unknown`

Note: Podman's transitional `"stopping"` state is mapped to `"running"` server-side so the UI
doesn't flash an unknown state during the brief teardown window.

---

## WebSocket API

All WebSocket endpoints require `?token=<token>` in the URL.

### Log streaming

```
GET /api/v1/containers/:id/logs?token=<token>
```

Streams newline-delimited JSON frames:
```json
{ "stream": "stdout", "line": "127.0.0.1 - GET / HTTP/1.1 200\n" }
{ "stream": "stderr", "line": "error: something went wrong\n" }
```

The last 200 lines of history are replayed on connect (`tail: "200"`), then new lines stream live.

### Stats streaming

```
GET /api/v1/containers/:id/stats?token=<token>
```

Streams one JSON frame per second:
```json
{
  "cpu_percent": 2.3,
  "memory_usage": 52428800,
  "memory_limit": 8589934592,
  "memory_percent": 0.61
}
```

CPU is calculated as `(cpu_delta / system_delta) * online_cpus * 100`.

### Terminal (exec)

```
GET /api/v1/containers/:id/exec?token=<token>
```

Bidirectional PTY bridge. Protocol:

| Direction | Frame type | Content |
|---|---|---|
| Client → Server | Binary | Raw terminal input bytes |
| Client → Server | Text (JSON) | `{"type":"resize","cols":220,"rows":50}` |
| Server → Client | Binary | Raw terminal output bytes (ANSI sequences intact) |

The server creates a TTY exec session running `/bin/sh`. xterm.js on the frontend handles
rendering the ANSI escape sequences.

---

## Frontend Architecture

### Routing

[TanStack Router](https://tanstack.com/router) with file-based route generation via
`@tanstack/router-plugin`. The route tree is auto-generated into `src/routeTree.gen.ts`
by the Vite plugin — never edit that file manually.

```
/                    → redirects to /containers
/containers          → containers.tsx (layout)
/containers/         → containers.index.tsx (list page)
/containers/:id      → containers.$id.tsx (detail page)
```

### Server state

[TanStack Query](https://tanstack.com/query) manages all API data. Key conventions:

- `queryKey: ["containers"]` — the container list, refetched every 5 seconds
- Mutations call `queryClient.invalidateQueries({ queryKey: ["containers"] })` on success
  to trigger a fresh fetch
- Never use `getQueryData` for reactive rendering — use `useQuery` so the component
  re-renders when the cache updates

### Theming

Tailwind v4 with CSS variable theming. Light/dark/system toggle stored in `localStorage`
via a `ThemeProvider`. All colours reference CSS custom properties (`--background`,
`--foreground`, etc.) defined in `index.css` for both `:root` (light) and `.dark` scopes.

Custom chart colours:
```css
--chart-orange: oklch(0.72 0.19 50);   /* CPU */
--chart-purple: oklch(0.58 0.22 285);  /* Memory */
```

---

## Real-Time Data

### Log streaming (`use-container-logs.ts`)

Opens a WebSocket on mount, accumulates lines in a ref (to avoid closure stale state),
and syncs to React state. Key behaviour:

- **WebKit `onerror` on clean close**: WebKit fires `onerror` even when the server closes the
  WebSocket cleanly. Guard with an `everConnected` ref — only surface the error if `onopen`
  never fired.
- **Reconnection after restart**: The container detail page tracks a `runSession` counter that
  increments each time the container transitions into `"running"`. `LogsPanel` receives this
  as its `key` prop, causing it to unmount/remount and open a fresh WebSocket.

### Stats streaming (`use-container-stats.ts`)

Same WebSocket pattern but accumulates a rolling 60-point history for the charts.

**Tab switching problem**: shadcn Tabs unmounts inactive content by default. If the stats hook
lived inside the Stats tab, switching to Logs would kill the WebSocket and lose the rolling
history. Solution: lift `useContainerStats` to the parent page component so it runs in the
background regardless of which tab is visible.

Stats are only connected when the container is running — the hook receives an empty string as
`containerId` when stopped, which causes the `useEffect` to early-return.

---

## Container Terminal

**File:** `src-tauri/src/daemon/routes/terminal.rs` (server), `src/components/terminal-panel.tsx` (client)

### Server side

1. `bollard::Docker::create_exec` — creates a TTY exec session with stdin/stdout/stderr attached
2. `bollard::Docker::start_exec` — starts it and returns `StartExecResults::Attached { input, output }`
3. The WebSocket is split into send/receive halves; exec is split into input (AsyncWrite) / output (Stream)
4. Two tasks run concurrently:
   - **WS → exec**: binary frames → `exec_input.write_all()`, text frames → `resize_exec()`
   - **exec → WS**: `LogOutput::Console { message }` bytes → binary WebSocket frames

With TTY enabled, Podman merges stdout/stderr and sends raw ANSI sequences as `LogOutput::Console`.

### Client side (`terminal-panel.tsx`)

- **xterm.js Terminal** with a zinc dark theme (hardcoded — terminals are always dark)
- **FitAddon** measures the container div and resizes the terminal to fill it
- **ResizeObserver** watches the container div and calls `fitAddon.fit()` + sends a resize
  message to the server whenever the layout changes (window resize, sidebar toggle, etc.)
- `terminal.onData` → sends raw bytes to the server as a binary WebSocket frame
- Server output → `terminal.write(new Uint8Array(data))` — xterm.js renders the ANSI sequences

**Session persistence across tab switches:** The terminal div is rendered outside Radix Tabs'
unmount lifecycle. A `terminalMounted` flag lazily mounts the component on first visit to the
Terminal tab, and it stays mounted (hidden via CSS) when switching to other tabs. This preserves
the shell session. A `isActive` prop triggers `fitAddon.fit()` on tab return.

---

## UI State Transitions

Container start/stop flows through a defined state machine in the UI:

```
[exited/stopped]
      │  click Start
      ▼
  "starting"  ← startMutation.isPending = true (held for ≥700ms by useMinPending)
  blue badge, blue Play icon, blinking
      │  API responds + query refetches
      ▼
  [running]
  green badge, red Stop button
      │  click Stop
      ▼
  "stopping"  ← stopMutation.isPending = true (held for ≥700ms)
  orange badge, orange Square icon, blinking
      │  API responds + query refetches
      ▼
  [exited/stopped]
```

The `animate-blink` utility class (defined in `index.css`) pulses opacity 1 → 0.25 → 1
at 0.85s intervals — faster than Tailwind's default `animate-pulse` (2s) so it reads
as a live indicator rather than a loading state.

---

## Key Patterns

### `useMinPending(isPending, minMs = 700)`

**File:** `src/hooks/use-min-pending.ts`

Problem: fast containers (start/stop in <200ms) cause buttons to flash through states too
quickly to read. `useMinPending` holds `true` for at least `minMs` after `isPending` was
last `true`, giving the transitional UI a minimum display window.

### Pending-first button rendering

Buttons use pending state as the highest priority condition:

```tsx
{stopPending    ? <Button disabled>Stopping…</Button>
 : startPending ? <Button disabled>Starting…</Button>
 : isRunning    ? <Button onClick={stop}>Stop</Button>
 : canStart     ? <Button onClick={start}>Start</Button>
 : null}
```

This avoids the "optimistic update flicker" where clicking Stop immediately showed a disabled
Start button (because the optimistic cache update set status to `"exited"` before the API
confirmed it).

### No optimistic cache updates

An earlier iteration used `queryClient.setQueryData` in `onMutate` to instantly flip the
container status in cache. This caused the wrong button to appear (Stop clicked → disabled
Start shown instead of "Stopping…"). Reverted to `isPending`-first rendering with
`invalidateQueries` on success only.

### WebSocket `everConnected` ref

WebKit (used by Tauri's webview on macOS) fires `onerror` even on clean WebSocket closes.
Without the guard, users would see "Failed to connect" flashing after every normal disconnect.
Fix: set `everConnected = true` in `onopen`; only show `onerror` if `!everConnected.current`.
Also call `setError(null)` in `onopen` to clear any error from a previous connection attempt.

---

## Development Conventions

### Commands

```bash
pnpm tauri dev        # Full dev mode — Vite + Tauri window
pnpm dev              # Frontend only (no desktop window, no auth)
pnpm build            # TypeScript check + Vite build
cargo clippy          # Rust linting — run before every Rust commit
```

### Commit style

Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `style:`

### Language

Australian English in all comments, docs, and UI copy: `colour`, `behaviour`, `serialise`,
`initialise`, `authorise`.

### Code style — Rust

- Idiomatic Rust — no shortcuts that'll bite later
- `cargo clippy` clean before committing
- `anyhow` for error handling in application code; typed errors for library-style modules
- `tracing` for structured logging, not `println!`

### Code style — TypeScript/React

- Strict mode — no `any`, no unused vars
- TanStack Query for all server state — no raw `useState` + `useEffect` for data fetching
- Custom hooks for WebSocket connections — keep component JSX clean
- shadcn/ui components only — don't reach for raw HTML elements where a component exists

### Adding a new REST endpoint

1. Add handler function in the relevant `routes/*.rs` file
2. Register the route in that file's `router()` function
3. Auth is applied automatically — no per-route changes needed
4. Add the typed call to `src/lib/api.ts`

### Adding a new WebSocket endpoint

Same as REST, plus:
1. Use `ws://` URL via `wsUrl()` from `api.ts` — never hardcode the URL or token
2. Implement the `everConnected` ref pattern in the hook to handle WebKit's onerror behaviour

---

## Roadmap

### In progress / next
- Images page (list, pull, delete)
- Volumes page
- Networks page
- Container start (already implemented alongside stop)

### Planned
- Compose stack view with multi-container dependency graph
- Log search and filtering
- Port mapping visualisation
- Image layer inspector
- Resource graphs with configurable time windows
- Multi-machine management (connect to multiple remote daemons simultaneously)
- Headless daemon mode with proper systemd integration
- CLI (`harbr daemon install/start/stop/status`)
- SurrealDB for connection profiles, compose history, settings persistence
- Auth hardening: token rotation, multiple tokens for remote access
- CSP tightening (currently null in `tauri.conf.json`)
- macOS and Windows support (Podman machine integration)
