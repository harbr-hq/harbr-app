#Requires -Version 5.1
<#
.SYNOPSIS
    Builds Harbr on Windows.

.DESCRIPTION
    Run from the windows\ folder after Step1-Prerequisites.ps1 has completed.
    Do NOT run as Administrator.

.EXAMPLE
    .\Step2-Build.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step([string]$message) {
    Write-Host ""
    Write-Host ">> $message" -ForegroundColor Cyan
}

function Write-Ok([string]$message) {
    Write-Host "   OK  $message" -ForegroundColor Green
}

function Write-Skip([string]$message) {
    Write-Host "   --  $message (skipping)" -ForegroundColor DarkGray
}

function Write-Warn([string]$message) {
    Write-Host "   !!  $message" -ForegroundColor Yellow
}

function Write-Fatal([string]$message) {
    Write-Host ""
    Write-Host "[FATAL] $message" -ForegroundColor Red
    exit 1
}

function Command-Exists([string]$name) {
    return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

# Run from repo root (one level up from this script)
$repoRoot = Split-Path $PSScriptRoot
Set-Location $repoRoot

Write-Host ""
Write-Host "Harbr -- Build" -ForegroundColor White
Write-Host "==============" -ForegroundColor White

# Sanity checks
if (-not (Test-Path "src-tauri\Cargo.toml")) {
    Write-Fatal "src-tauri not found. Run this from the windows\ folder inside the cloned repo."
}

foreach ($tool in @("rustc", "cargo", "node", "pnpm", "podman")) {
    if (-not (Command-Exists $tool)) {
        Write-Fatal "$tool not found. Run Step1-Prerequisites.ps1 first, then open a new terminal."
    }
}

Write-Ok "Prerequisites found"

# Podman Machine
Write-Step "Checking Podman Machine"

$machines = podman machine list --format json 2>$null | ConvertFrom-Json
$machine = $machines | Where-Object { $_.Default -eq $true } | Select-Object -First 1
if (-not $machine) { $machine = $machines | Select-Object -First 1 }

if (-not $machine) {
    Write-Host "   No Podman Machine found -- initialising (downloads a VM image)..."
    podman machine init
    if ($LASTEXITCODE -ne 0) { Write-Fatal "podman machine init failed." }
    $machines = podman machine list --format json 2>$null | ConvertFrom-Json
    $machine = $machines | Select-Object -First 1
}

if ($machine.Running) {
    Write-Skip "Podman Machine already running ($($machine.Name))"
} else {
    Write-Host "   Starting Podman Machine ($($machine.Name))..."
    podman machine start $machine.Name
    if ($LASTEXITCODE -ne 0) { Write-Fatal "podman machine start failed." }
    Write-Ok "Podman Machine started"
}

$socketPath = "npipe:////./pipe/$($machine.Name)"
Write-Ok "Socket: $socketPath"

# Config
Write-Step "Creating Harbr config"

$configDir  = Join-Path $env:APPDATA "harbr"
$configFile = Join-Path $configDir "config.toml"

if (-not (Test-Path $configDir)) { New-Item -ItemType Directory -Path $configDir | Out-Null }

if (Test-Path $configFile) {
    Write-Skip "$configFile already exists -- not overwriting"
} else {
    $tokenPath = (Join-Path $configDir "token") -replace "\\", "\\"
    Set-Content -Path $configFile -Encoding UTF8 -Value @"
[server]
host = "127.0.0.1"
port = 9090

[auth]
enabled = true
token_file = "$tokenPath"

[podman]
socket = "$socketPath"

[logging]
level = "info"
"@
    Write-Ok "Config written to $configFile"
}

# Frontend deps
Write-Step "Installing frontend dependencies"
pnpm install
if ($LASTEXITCODE -ne 0) { Write-Fatal "pnpm install failed." }
Write-Ok "Dependencies installed"

# Build
Write-Step "Building Harbr (pnpm tauri build)"
Write-Warn "First build takes several minutes while Cargo compiles dependencies."
pnpm tauri build
if ($LASTEXITCODE -ne 0) { Write-Fatal "Build failed. Check output above." }

# Done
$bundleDir = "src-tauri\target\release\bundle"
Write-Host ""
Write-Host "==============" -ForegroundColor White
Write-Host ""
Write-Host "Build complete." -ForegroundColor Green
Write-Host "Installer: $repoRoot\$bundleDir"

if (Test-Path $bundleDir) { Invoke-Item $bundleDir }
Write-Host "Config:    $configFile"
