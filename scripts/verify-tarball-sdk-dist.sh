#!/usr/bin/env bash
# Verify the published get-shit-done-cc tarball actually contains
# sdk/dist/cli.js and that the `query` subcommand is exposed.
#
# Guards regression of bug #2647: v1.38.3 shipped without sdk/dist/
# because the outer `files` whitelist and `prepublishOnly` chain
# drifted out of alignment. Any future drift fails release CI here.
#
# Run AFTER `npm run build:sdk` (so sdk/dist exists on disk) and
# before `npm publish`. Exits non-zero on any mismatch.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Packing tarball (ignore-scripts: sdk/dist must already exist)"
TARBALL=$(npm pack --ignore-scripts 2>/dev/null | tail -1)
if [ -z "$TARBALL" ] || [ ! -f "$TARBALL" ]; then
  echo "::error::npm pack produced no tarball"
  exit 1
fi
echo "    tarball: $TARBALL"

EXTRACT_DIR=$(mktemp -d)
trap 'rm -rf "$EXTRACT_DIR" "$TARBALL"' EXIT

echo "==> Extracting tarball into $EXTRACT_DIR"
tar -xzf "$TARBALL" -C "$EXTRACT_DIR"

CLI_JS="$EXTRACT_DIR/package/sdk/dist/cli.js"
if [ ! -f "$CLI_JS" ]; then
  echo "::error::$CLI_JS is missing from the published tarball"
  echo "Tarball contents under sdk/:"
  find "$EXTRACT_DIR/package/sdk" -maxdepth 2 -print | head -40
  exit 1
fi
echo "    OK: sdk/dist/cli.js present ($(wc -c < "$CLI_JS") bytes)"

echo "==> Installing runtime deps inside the extracted package and invoking gsd-sdk query --help"
pushd "$EXTRACT_DIR/package" >/dev/null
# Install only production deps so the extracted tarball resolves
# @anthropic-ai/claude-agent-sdk / ws the same way a real user install would.
npm install --omit=dev --no-audit --no-fund --silent
OUTPUT=$(node sdk/dist/cli.js query --help 2>&1 || true)
popd >/dev/null

echo "$OUTPUT" | head -20
if ! echo "$OUTPUT" | grep -qi 'query'; then
  echo "::error::sdk/dist/cli.js did not expose a 'query' subcommand"
  exit 1
fi
if echo "$OUTPUT" | grep -qiE 'unknown command|unrecognized'; then
  echo "::error::sdk/dist/cli.js rejected 'query' as unknown"
  exit 1
fi

echo "==> Also verifying gsd-sdk bin shim resolves ../sdk/dist/cli.js"
SHIM="$EXTRACT_DIR/package/bin/gsd-sdk.js"
if [ ! -f "$SHIM" ]; then
  echo "::error::bin/gsd-sdk.js missing from tarball"
  exit 1
fi
if ! grep -qE "sdk.*dist.*cli\.js" "$SHIM"; then
  echo "::error::bin/gsd-sdk.js does not reference sdk/dist/cli.js"
  exit 1
fi

echo "==> Tarball verification passed"
