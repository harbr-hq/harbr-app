#!/bin/bash
# Remove all build artifacts and dependency caches.
# Run before copying or archiving the source -- cuts the directory from ~40GB down to ~9GB.

set -e

cargo clean --manifest-path src-tauri/Cargo.toml
rm -rf node_modules dist

echo "Clean. $(du -sh . | cut -f1) remaining."
