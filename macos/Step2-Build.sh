#!/bin/bash
# Build Harbr and set up the initial config on macOS.
# Run this after Step1-Prerequisites.sh has completed.
#
# Usage:
#   ./Step2-Build.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
GRAY='\033[0;37m'
RESET='\033[0m'

step()  { echo -e "\n${CYAN}>> $1${RESET}"; }
ok()    { echo -e "   ${GREEN}OK${RESET}  $1"; }
skip()  { echo -e "   ${GRAY}--  $1 (skipping)${RESET}"; }
warn()  { echo -e "   ${YELLOW}!!  $1${RESET}"; }
fatal() { echo -e "\n${RED}[FATAL] $1${RESET}"; exit 1; }

# Run from repo root (one level up from this script)
cd "$(dirname "$0")/.."

echo ""
echo "Harbr -- Build"
echo "=============="

# ---------------------------------------------------------------------------
# Sanity checks
# ---------------------------------------------------------------------------

[ -f "src-tauri/Cargo.toml" ] || fatal "src-tauri not found -- source files may be missing."

for tool in rustc cargo node pnpm podman; do
    command -v "$tool" &>/dev/null || fatal "$tool not found in PATH. Run Step1-Prerequisites.sh first, then open a new terminal."
done

# Load cargo env in case it wasn't picked up
[ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"

ok "Prerequisites found"

# ---------------------------------------------------------------------------
# Podman Machine
# ---------------------------------------------------------------------------

step "Checking Podman Machine"

machines=$(podman machine list --format json 2>/dev/null)
machine_name=$(echo "$machines" | python3 -c "
import json, sys
data = json.load(sys.stdin)
default = next((m for m in data if m.get('Default')), None) or (data[0] if data else None)
print(default['Name'] if default else '')
" 2>/dev/null || echo "")

if [ -z "$machine_name" ]; then
    echo "   No Podman Machine found. Initialising (downloads a VM image -- may take a few minutes)..."
    podman machine init
    machine_name=$(podman machine list --format json 2>/dev/null | python3 -c "
import json, sys; data = json.load(sys.stdin); print(data[0]['Name'] if data else '')
" 2>/dev/null || echo "podman-machine-default")
fi

running=$(podman machine list --format json 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
m = next((m for m in data if m.get('Name') == '$machine_name'), None)
print(str(m.get('Running', False)).lower() if m else 'false')
" 2>/dev/null || echo "false")

if [ "$running" = "true" ]; then
    skip "Podman Machine already running ($machine_name)"
else
    echo "   Starting Podman Machine ($machine_name)..."
    podman machine start "$machine_name"
    ok "Podman Machine started"
fi

# ---------------------------------------------------------------------------
# Detect socket path
# ---------------------------------------------------------------------------

step "Detecting Podman socket"

socket_path=$(podman machine inspect "$machine_name" --format '{{.ConnectionInfo.PodmanSocket.Path}}' 2>/dev/null || echo "")

if [ -z "$socket_path" ]; then
    warn "Could not detect socket path automatically."
    warn "Get it manually with: podman machine inspect --format '{{.ConnectionInfo.PodmanSocket.Path}}'"
    warn "Then update: ~/Library/Application Support/harbr/config.toml"
    socket_path="/tmp/podman-unknown.sock"
else
    ok "Socket: $socket_path"
fi

# ---------------------------------------------------------------------------
# Harbr config
# ---------------------------------------------------------------------------

step "Creating Harbr config"

config_dir="$HOME/Library/Application Support/harbr"
config_file="$config_dir/config.toml"

mkdir -p "$config_dir"

if [ -f "$config_file" ]; then
    skip "$config_file already exists -- not overwriting"
else
    cat > "$config_file" <<EOF
[server]
host = "127.0.0.1"
port = 9090

[auth]
enabled = true
token_file = "$config_dir/token"

[podman]
socket = "unix://$socket_path"

[logging]
level = "info"
EOF
    ok "Config written to $config_file"
fi

# ---------------------------------------------------------------------------
# Frontend dependencies
# ---------------------------------------------------------------------------

step "Installing frontend dependencies (pnpm install)"
pnpm install
ok "Dependencies installed"

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

step "Building Harbr (pnpm tauri build)"
warn "This will take several minutes on first run while Cargo compiles dependencies."
pnpm tauri build

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------

bundle_dir="src-tauri/target/release/bundle/macos"

echo ""
echo "=============="
echo ""
echo -e "${GREEN}Build complete.${RESET}"

if [ -d "$bundle_dir" ]; then
    echo "App bundle: $bundle_dir"
    echo ""
    echo "Opening bundle folder..."
    open "$bundle_dir"
else
    echo "Bundle output: src-tauri/target/release/bundle/"
fi

echo ""
echo "Config: $config_file"
echo ""
warn "First launch: macOS will block the app as unsigned."
warn "Right-click the .app -> Open -> Open to bypass Gatekeeper."
