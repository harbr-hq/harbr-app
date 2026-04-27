#Requires -Version 5.1
<#
.SYNOPSIS
    Installs all prerequisites required to build Harbr on Windows.

.DESCRIPTION
    Run as Administrator from the windows\ folder inside the cloned repo.
    Safe to re-run -- already-installed items are skipped.
    Some steps (WSL2, long paths) require a restart; the script will tell you when.

.EXAMPLE
    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
    .\Step1-Prerequisites.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Script:needsRestart = $false

function Write-Step([string]$message) {
    Write-Host ""
    Write-Host ">> $message" -ForegroundColor Cyan
}

function Write-Ok([string]$message) {
    Write-Host "   OK  $message" -ForegroundColor Green
}

function Write-Skip([string]$message) {
    Write-Host "   --  $message (already installed, skipping)" -ForegroundColor DarkGray
}

function Write-Warn([string]$message) {
    Write-Host "   !!  $message" -ForegroundColor Yellow
}

function Write-Fatal([string]$message) {
    Write-Host ""
    Write-Host "[FATAL] $message" -ForegroundColor Red
    exit 1
}

function Is-Admin {
    $identity  = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Command-Exists([string]$name) {
    return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

function Winget-Installed([string]$id) {
    $result = winget list --id $id --exact 2>$null
    return ($LASTEXITCODE -eq 0) -and ($result -match $id)
}

function Winget-Install([string]$id, [string]$label) {
    Write-Step "Installing $label"
    if (Winget-Installed $id) {
        Write-Skip $label
        return
    }
    winget install --id $id --exact --silent --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        Write-Fatal "winget failed to install $label. Install manually and re-run."
    }
    Write-Ok "$label installed"
}

function Refresh-Path {
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("PATH", "User")
}

# ---------------------------------------------------------------------------

if (-not (Is-Admin)) {
    Write-Fatal "Run as Administrator -- right-click PowerShell -> Run as administrator."
}

Write-Host ""
Write-Host "Harbr -- Windows Prerequisites" -ForegroundColor White
Write-Host "==============================" -ForegroundColor White

# winget
Write-Step "Checking winget"
if (-not (Command-Exists "winget")) {
    Write-Fatal "winget not found. Install 'App Installer' from the Microsoft Store, then re-run."
}
Write-Ok "winget available"

# Long paths
Write-Step "Enabling long path support"
$longPathKey = "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem"
$current = (Get-ItemProperty $longPathKey -Name LongPathsEnabled -ErrorAction SilentlyContinue).LongPathsEnabled
if ($current -eq 1) {
    Write-Skip "LongPathsEnabled"
} else {
    Set-ItemProperty -Path $longPathKey -Name LongPathsEnabled -Value 1 -Type DWord
    Write-Ok "Long paths enabled (takes effect after restart)"
    $Script:needsRestart = $true
}

# WSL2
Write-Step "Checking WSL2"
$wslFeature = Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -ErrorAction SilentlyContinue
$vmFeature  = Get-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -ErrorAction SilentlyContinue

if (($wslFeature.State -eq "Enabled") -and ($vmFeature.State -eq "Enabled")) {
    Write-Skip "WSL2"
} else {
    Write-Warn "Enabling WSL2 -- a restart will be required."
    if ($wslFeature.State -ne "Enabled") {
        Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart | Out-Null
    }
    if ($vmFeature.State -ne "Enabled") {
        Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart | Out-Null
    }
    Write-Ok "WSL2 features enabled"
    $Script:needsRestart = $true
}

# MSVC Build Tools
Write-Step "Checking MSVC Build Tools"
$vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$hasMsvc = $false
if (Test-Path $vsWhere) {
    $installations = & $vsWhere -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -format json 2>$null | ConvertFrom-Json
    $hasMsvc = $installations.Count -gt 0
}

if ($hasMsvc) {
    Write-Skip "MSVC Build Tools"
} else {
    Write-Step "Installing MSVC Build Tools 2022 (this takes a while)"
    $overrideArgs = "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.Windows11SDK.26100 --includeRecommended"
    winget install --id Microsoft.VisualStudio.2022.BuildTools --exact --silent `
        --accept-package-agreements --accept-source-agreements `
        --override $overrideArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "winget returned non-zero -- this sometimes happens even on success."
        Write-Warn "Verify: look for 'x64 Native Tools Command Prompt for VS 2022' in Start menu."
    } else {
        Write-Ok "MSVC Build Tools installed"
    }
}

# WebView2
Write-Step "Checking WebView2"
$webview2Key = "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
if (Test-Path $webview2Key) {
    Write-Skip "WebView2"
} else {
    Winget-Install "Microsoft.EdgeWebView2Runtime" "WebView2 Runtime"
}

# Rust
Write-Step "Checking Rust"
if (Command-Exists "rustc") {
    Write-Skip "Rust ($(rustc --version))"
} else {
    Winget-Install "Rustlang.Rustup" "Rust (rustup)"
    Refresh-Path
}

# Node.js
Write-Step "Checking Node.js"
if (Command-Exists "node") {
    Write-Skip "Node.js ($(node --version))"
} else {
    Winget-Install "OpenJS.NodeJS.LTS" "Node.js LTS"
    Refresh-Path
}

# pnpm
Write-Step "Checking pnpm"
if (Command-Exists "pnpm") {
    Write-Skip "pnpm ($(pnpm --version))"
} else {
    npm install -g pnpm
    if ($LASTEXITCODE -ne 0) { Write-Fatal "pnpm installation failed." }
    Write-Ok "pnpm installed"
}

# Podman
Write-Step "Checking Podman"
if (Command-Exists "podman") {
    Write-Skip "Podman ($(podman --version))"
} else {
    Winget-Install "RedHat.Podman" "Podman"
    Refresh-Path
}

# podman-compose
Write-Step "Checking podman-compose"
if (Command-Exists "podman-compose") {
    Write-Skip "podman-compose"
} else {
    if (Command-Exists "pip") {
        pip install podman-compose
    } elseif (Command-Exists "pip3") {
        pip3 install podman-compose
    } else {
        Write-Warn "pip not found -- install Python then run: pip install podman-compose"
    }
    if ($LASTEXITCODE -eq 0) { Write-Ok "podman-compose installed" }
}

# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "==============================" -ForegroundColor White

if ($Script:needsRestart) {
    Write-Host ""
    Write-Host "[RESTART REQUIRED]" -ForegroundColor Yellow
    Write-Host "After restarting:"
    Write-Host "  1. Re-run this script to confirm everything is in order"
    Write-Host "  2. Then run .\Step2-Build.ps1"
} else {
    Write-Host ""
    Write-Host "All prerequisites installed." -ForegroundColor Green
    Write-Host "Open a new PowerShell window (not Admin) and run:"
    Write-Host "  .\Step2-Build.ps1" -ForegroundColor Cyan
}
