#!/usr/bin/env bash
# Install @nexeradigital/gsd-autopilot
# Usage: curl -fsSL https://raw.githubusercontent.com/NexeraDigital/get-shit-done/main/autopilot/install.sh | bash

set -euo pipefail

PACKAGE="@nexeradigital/gsd-autopilot"

echo "Installing ${PACKAGE}..."
echo ""

# 1. Ensure Node.js >= 20
if ! command -v node &>/dev/null; then
  echo "Error: Node.js is required but not installed."
  echo "Install it from https://nodejs.org (v20+)"
  exit 1
fi

NODE_MAJOR=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Error: Node.js >= 20 required (found v$(node -v))"
  exit 1
fi

# 2. Ensure GSD workflows are installed
if ! npx get-shit-done-cc --version &>/dev/null 2>&1; then
  echo "Warning: GSD workflows not found. Installing get-shit-done-cc..."
  npm install -g get-shit-done-cc@latest
fi

# 3. Install globally
echo ""
echo "Running: npm install -g ${PACKAGE}"
npm install -g "${PACKAGE}"

echo ""
echo "Done! Restart Claude Code to use /gsd:autopilot"
