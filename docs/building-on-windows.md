# Building Harbr on Windows

> **No pre-built releases yet.** You'll need to compile from source.

> **Disk space:** Allow at least 20 GB of free space before starting. Windows 11 + MSVC build tools + Podman Machine + Rust's dependency cache + Tauri build artifacts all add up. If you're in a VM, size the disk accordingly before you begin — expanding it mid-build is painful.

---

## Prerequisites

### 1. Microsoft C++ Build Tools

Tauri requires the MSVC toolchain — MinGW will not work.

Install either:
- [Visual Studio 2022](https://visualstudio.microsoft.com/) with the **Desktop development with C++** workload, or
- [Build Tools for Visual Studio 2022](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (lighter — just the compiler, no IDE)

Make sure **Windows 10/11 SDK** is selected during installation.

### 2. WebView2

Harbr's desktop window runs on WebView2. It ships pre-installed on Windows 10 (20H2+) and Windows 11.

If you're on an older build, download the Evergreen Bootstrapper from [Microsoft](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).

### 3. Rust

Install via [rustup.rs](https://rustup.rs). During setup, select **option 1 (default)** — this installs the `x86_64-pc-windows-msvc` target automatically.

Verify:

```powershell
rustc --version
cargo --version
```

If you already have Rust installed with a different toolchain, add the MSVC target:

```powershell
rustup target add x86_64-pc-windows-msvc
rustup toolchain install stable-x86_64-pc-windows-msvc
```

### 4. Node.js and pnpm

- [Node.js 20+](https://nodejs.org/) (LTS recommended)
- pnpm: `npm install -g pnpm`

### 5. Podman

Podman on Windows runs via a lightweight virtual machine (backed by WSL2 or HyperV). The simplest path:

```powershell
winget install RedHat.Podman
```

Or download the MSI from [github.com/containers/podman/releases](https://github.com/containers/podman/releases).

After installing, initialise and start Podman Machine, then install `podman-compose` for Compose support:

```powershell
podman machine init
podman machine start
```

Verify it's running:

```powershell
podman ps
```

Then install `podman-compose` for Compose support (Podman 5.x still needs an external backend):

```powershell
pip install podman-compose
```

---

## Config File

Harbr's config lives at:

```
%APPDATA%\harbr\config.toml
```

Typically `C:\Users\<your-username>\AppData\Roaming\harbr\config.toml`.

Create the directory and file if they don't exist. At minimum, set the Podman socket path — Windows uses a named pipe instead of a Unix socket:

```toml
[podman]
socket = "npipe:////./pipe/podman-machine-default"
```

If you've given your Podman Machine a custom name, adjust accordingly:

```powershell
# Check your machine name
podman machine list
```

The pipe name will be `npipe:////./pipe/podman-<machine-name>`.

Full example config with all defaults made explicit:

```toml
[server]
host = "127.0.0.1"
port = 9090

[auth]
enabled = true
token_file = "C:\\Users\\<your-username>\\AppData\\Roaming\\harbr\\token"

[podman]
socket = "npipe:////./pipe/podman-machine-default"

[logging]
level = "info"
```

---

## Building

```powershell
# Clone
git clone https://github.com/harbr-hq/harbr.git
cd harbr

# Install frontend dependencies
pnpm install

# Dev mode (live reload, Tauri window)
pnpm tauri dev

# Production build
pnpm tauri build
```

The built installer will be at `src-tauri/target/release/bundle/`.

---

## Known Issues

**Long path errors during Cargo build**

Windows limits paths to 260 characters by default. Cargo's dependency tree can exceed this.

Enable long paths:

```powershell
# Run as Administrator
reg add "HKLM\SYSTEM\CurrentControlSet\Control\FileSystem" /v LongPathsEnabled /t REG_DWORD /d 1 /f
```

Then restart your terminal.

**Podman Machine not starting**

WSL2 must be enabled. If it isn't:

```powershell
# Run as Administrator
wsl --install
```

Restart after installation, then try `podman machine start` again.

**Named pipe connection refused**

Make sure Podman Machine is actually running before launching Harbr:

```powershell
podman machine list   # Status column should show "Running"
podman machine start  # If it's stopped
```

**`pnpm tauri dev` fails with MSVC errors**

Ensure the **Visual C++ Redistributable** and **Windows SDK** are installed. Re-run the Visual Studio installer and verify the **Desktop development with C++** workload is fully installed.

---

## Auth Token

On first run, Harbr generates a bearer token at the path set in `auth.token_file`. By default this is:

```
%APPDATA%\harbr\token
```

The Tauri desktop app retrieves this automatically via IPC — you don't need to handle it manually unless you're running in headless mode.
