# Building Harbr on macOS

> **No pre-built releases yet.** You'll need to compile from source.

> **Disk space:** Allow at least 20 GB of free space. Rust's dependency cache and Tauri build artifacts are the main culprits.

**Minimum:** macOS 12 (Monterey). Works on both Intel and Apple Silicon.

---

## Prerequisites

### 1. Xcode Command Line Tools

```bash
xcode-select --install
```

Follow the dialog. If already installed it'll say so — move on.

### 2. Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

On Apple Silicon, follow the prompt at the end to add Homebrew to your PATH, then restart your terminal.

### 3. Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

### 4. Node.js and pnpm

```bash
brew install node
npm install -g pnpm
```

### 5. Podman

```bash
brew install podman
podman machine init
podman machine start
```

### 6. podman-compose

Podman 5.x still requires an external compose backend:

```bash
pip3 install podman-compose
```

---

## Config File

Harbr's config lives at:

```
~/Library/Application Support/harbr/config.toml
```

The socket path varies between machines and restarts. Get yours with:

```bash
podman machine inspect --format '{{.ConnectionInfo.PodmanSocket.Path}}'
```

Minimal config:

```toml
[podman]
socket = "unix:///path/from/above"
```

---

## Building

```bash
# Clone or copy the source, then from the repo root:
pnpm install
pnpm tauri build
```

Or use the scripts in the `macos/` folder if you received a source archive:

```bash
chmod +x macos/Step1-Prerequisites.sh macos/Step2-Build.sh
./macos/Step1-Prerequisites.sh   # install prerequisites
./macos/Step2-Build.sh           # build the app
```

Built app will be in `src-tauri/target/release/bundle/macos/`.

---

## Known Issues

**Gatekeeper blocks the app on first launch**

macOS refuses to open unsigned apps with a double-click. Right-click the `.app` → Open → Open to bypass. One time only.

**Podman socket path changes between restarts**

If Harbr can't connect after a reboot, check Podman Machine is running:

```bash
podman machine list
podman machine start
```

Then re-check the socket path and update your config if it changed.

**Apple Silicon: `cargo` not found after install**

The PATH update from rustup doesn't apply to the current terminal session. Run:

```bash
source "$HOME/.cargo/env"
```

Or just open a new terminal.
