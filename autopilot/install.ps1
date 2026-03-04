# Install @nexeradigital/gsd-autopilot from GitHub Packages (public)
# Usage: irm https://raw.githubusercontent.com/NexeraDigital/get-shit-done/main/autopilot/install.ps1 | iex

$ErrorActionPreference = "Stop"

$Package  = "@nexeradigital/gsd-autopilot"
$Registry = "https://npm.pkg.github.com"
$Scope    = "@nexeradigital"
$Npmrc    = Join-Path $env:USERPROFILE ".npmrc"

Write-Host "Installing $Package..." -ForegroundColor Cyan
Write-Host ""

# 1. Ensure Node.js >= 20
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Node.js is required but not installed." -ForegroundColor Red
    Write-Host "Install it from https://nodejs.org (v20+)"
    exit 1
}

$nodeMajor = [int](node -e "process.stdout.write(process.versions.node.split('.')[0])")
if ($nodeMajor -lt 20) {
    $nodeVer = node -v
    Write-Host "Error: Node.js >= 20 required (found $nodeVer)" -ForegroundColor Red
    exit 1
}

# 2. Configure npm registry for @nexeradigital scope
$registryLine = "${Scope}:registry=${Registry}"
if (Test-Path $Npmrc) {
    $content = Get-Content $Npmrc -Raw
    if ($content -match [regex]::Escape("${Scope}:registry=")) {
        Write-Host "Registry already configured in $Npmrc"
    } else {
        Add-Content $Npmrc $registryLine
        Write-Host "Added $Scope registry to $Npmrc"
    }
} else {
    Set-Content $Npmrc $registryLine
    Write-Host "Created $Npmrc with $Scope registry"
}

# 3. Install globally
Write-Host ""
Write-Host "Running: npm install -g $Package" -ForegroundColor Cyan
npm install -g $Package

Write-Host ""
Write-Host "Done! Restart Claude Code to use /gsd:autopilot" -ForegroundColor Green
