# Harbr on Windows

See [docs/building-on-windows.md](../docs/building-on-windows.md) for the full setup guide.

## Quick Start

1. Clone the repo and open PowerShell in the `windows\` folder:

   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   .\Step1-Prerequisites.ps1
   ```

   Installs Rust, Node.js, pnpm, Podman, MSVC build tools, and podman-compose.
   Some steps require a restart — the script will tell you when. Re-run it after restarting.

2. Open a **new** PowerShell window (not as Admin):

   ```powershell
   .\Step2-Build.ps1
   ```

   Sets up Podman Machine, writes your config, builds the app.
