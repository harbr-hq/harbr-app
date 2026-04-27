#!/bin/bash
# Install all prerequisites required to build Harbr on macOS.
# Safe to re-run -- already-installed items are skipped.
#
# Usage:
#   chmod +x Step1-Prerequisites.sh
#   ./Step1-Prerequisites.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
GRAY='\033[0;37m'
RESET='\033[0m'

step()  { echo -e "\n${CYAN}>> $1${RESET}"; }
ok()    { echo -e "   ${GREEN}OK${RESET}  $1"; }
skip()  { echo -e "   ${GRAY}--  $1 (already installed, skipping)${RESET}"; }
warn()  { echo -e "   ${YELLOW}!!  $1${RESET}"; }
fatal() { echo -e "\n${RED}[FATAL] $1${RESET}"; exit 1; }

echo ""
echo "Harbr -- macOS Prerequisites Installer"
echo "======================================="

# ---------------------------------------------------------------------------
# macOS version check
# ---------------------------------------------------------------------------

step "Checking macOS version"
macos_version=$(sw_vers -productVersion)
major=$(echo "$macos_version" | cut -d. -f1)
minor=$(echo "$macos_version" | cut -d. -f2)

if [ "$major" -lt 12 ]; then
    fatal "macOS 12 (Monterey) or later is required. You're on $macos_version."
fi
ok "macOS $macos_version"

# ---------------------------------------------------------------------------
# Xcode Command Line Tools
# ---------------------------------------------------------------------------

step "Checking Xcode Command Line Tools"
if xcode-select -p &>/dev/null; then
    skip "Xcode Command Line Tools ($(xcode-select -p))"
else
    echo "   Installing Xcode Command Line Tools..."
    xcode-select --install
    echo "   Follow the dialog that appeared, then re-run this script."
    exit 0
fi

# ---------------------------------------------------------------------------
# Homebrew
# ---------------------------------------------------------------------------

step "Checking Homebrew"
if command -v brew &>/dev/null; then
    skip "Homebrew ($(brew --version | head -1))"
else
    echo "   Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # Apple Silicon: add brew to PATH for this session
    if [ -f "/opt/homebrew/bin/brew" ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
    ok "Homebrew installed"
fi

# ---------------------------------------------------------------------------
# Rust
# ---------------------------------------------------------------------------

step "Checking Rust"
if command -v rustc &>/dev/null; then
    skip "Rust ($(rustc --version))"
else
    echo "   Installing Rust via rustup..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path
    source "$HOME/.cargo/env"
    ok "Rust installed"
fi

# Ensure cargo env is loaded even if Rust was already installed
if [ -f "$HOME/.cargo/env" ]; then
    source "$HOME/.cargo/env"
fi

# ---------------------------------------------------------------------------
# Node.js
# ---------------------------------------------------------------------------

step "Checking Node.js"
if command -v node &>/dev/null; then
    skip "Node.js ($(node --version))"
else
    brew install node
    ok "Node.js installed"
fi

# ---------------------------------------------------------------------------
# pnpm
# ---------------------------------------------------------------------------

step "Checking pnpm"
if command -v pnpm &>/dev/null; then
    skip "pnpm ($(pnpm --version))"
else
    npm install -g pnpm
    ok "pnpm installed"
fi

# ---------------------------------------------------------------------------
# Podman
# ---------------------------------------------------------------------------

step "Checking Podman"
if command -v podman &>/dev/null; then
    skip "Podman ($(podman --version))"
else
    brew install podman
    ok "Podman installed"
fi

# ---------------------------------------------------------------------------
# podman-compose
# ---------------------------------------------------------------------------

step "Checking podman-compose"
if command -v podman-compose &>/dev/null; then
    skip "podman-compose ($(podman-compose --version 2>&1 | head -1))"
else
    if command -v pip3 &>/dev/null; then
        pip3 install podman-compose
    elif command -v pip &>/dev/null; then
        pip install podman-compose
    else
        warn "pip not found -- installing Python first"
        brew install python3
        pip3 install podman-compose
    fi
    ok "podman-compose installed"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo ""
echo "======================================="
echo ""
echo -e "${GREEN}All prerequisites installed.${RESET}"
echo ""
echo "Open a new terminal (to pick up PATH changes) then run:"
echo "  ./Step2-Build.sh"
