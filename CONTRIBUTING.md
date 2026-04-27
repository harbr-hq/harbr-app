# Contributing to Harbr

## Prerequisites

- Rust stable 1.75+
- Node.js 20+
- pnpm 9+
- Podman 4.x+ with user socket running:

```bash
systemctl --user enable --now podman.socket
```

- podman-compose:

```bash
pip install podman-compose
```

> **Windows:** Full setup guide at [docs/building-on-windows.md](docs/building-on-windows.md).
> **macOS:** Full setup guide at [docs/building-on-macos.md](docs/building-on-macos.md).

---

## Dev Setup

```bash
pnpm install
pnpm tauri dev
```

---

## Tech Stack

| Layer | Choice |
|---|---|
| Desktop shell | Tauri v2 |
| Frontend | React 19, TypeScript 5.8, Vite 7 |
| Routing | TanStack Router (file-based) |
| Server state | TanStack Query |
| UI components | shadcn/ui + Tailwind v4 |
| Charts | Recharts |
| Terminal | xterm.js v6 |
| Notifications | sonner |
| Package manager | pnpm |
| Backend | Rust |
| HTTP + WebSocket | Axum |
| Config | Figment |
| Container runtime | Podman (via bollard) |
| Local database | SurrealDB (embedded, kv-surrealkv) |

---

## Architecture

Single binary, two modes — desktop (Tauri window) and headless (daemon only).

```
┌─────────────────────────────┐
│  Tauri Shell (desktop)      │
│  or Browser (remote)        │
│  React + TanStack           │
└────────────┬────────────────┘
             │ HTTP / WebSocket
┌────────────▼────────────────┐
│  Rust / Axum daemon         │
│  Auth middleware             │
│  Log collection daemon       │
└───────┬──────────┬──────────┘
        │          │
┌───────▼──┐  ┌────▼────────┐
│  Podman  │  │  SurrealDB  │
│  socket  │  │  (embedded) │
└──────────┘  └─────────────┘
```

WebSockets for real-time (logs, stats, terminal). REST for everything else.

---

## Before Submitting a PR

- `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` — zero warnings
- `pnpm exec tsc --noEmit` — zero errors
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`
- Australian English in comments and docs (colour, behaviour, serialise)

If `tsc` complains about a missing route tree, run `pnpm exec vite build` first to regenerate it.

---

## Copying or Archiving the Source

Build artifacts balloon the repo to ~40 GB. Before copying to another machine or zipping it up, run:

```bash
./clean.sh
```

This removes `src-tauri/target/`, `node_modules/`, and `dist/` — dropping it back to ~9 GB of pure source.

---

## Filing Issues

**Bug:** OS, Podman version, steps to reproduce, what you expected vs what you got.

**Feature:** Describe the use case, not just the feature. What are you trying to do that Harbr doesn't currently support?

---

## Code Style

- **Rust:** idiomatic, no `unwrap()` in production paths, clippy-clean
- **TypeScript:** strict mode, no `any`, no unused vars
- Comments only where the logic isn't obvious — meaningful names over excessive documentation
- No placeholder or demo code on `main`
