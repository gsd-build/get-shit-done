#!/usr/bin/env bash
# Setup a test project that uses the forked GSD plugin instead of the global install.
#
# Usage:
#   ./scripts/setup-fork-test.sh [target-project-dir]
#
# If no target is given, creates ~/projects/gsd-fork-test/
#
# How it works:
#   - Copies all global GSD commands into the target project's .claude/commands/gsd/
#   - Rewrites workflow/template/reference paths to point at the fork
#   - Project-level commands take precedence over global, so only Claude Code
#     sessions opened in the target project use the fork. All other instances
#     continue using the original global install.

set -euo pipefail

FORK_RUNTIME="C:/Users/rickw/projects/get-shit-done/get-shit-done"
GLOBAL_RUNTIME="C:/Users/rickw/.claude/get-shit-done"
GLOBAL_COMMANDS="$HOME/.claude/commands/gsd"
TARGET_PROJECT="${1:-$HOME/projects/gsd-fork-test}"

if [ ! -d "$GLOBAL_COMMANDS" ]; then
  echo "ERROR: Global GSD commands not found at $GLOBAL_COMMANDS"
  exit 1
fi

if [ ! -d "$FORK_RUNTIME" ]; then
  echo "ERROR: Fork runtime not found at $FORK_RUNTIME"
  exit 1
fi

# Create target project structure
mkdir -p "$TARGET_PROJECT/.claude/commands/gsd"

# Initialize as git repo if not already (GSD expects this)
if [ ! -d "$TARGET_PROJECT/.git" ]; then
  git -C "$TARGET_PROJECT" init -q
  echo "Initialized git repo in $TARGET_PROJECT"
fi

# Copy and rewrite commands
count=0
for cmd_file in "$GLOBAL_COMMANDS"/*.md; do
  basename=$(basename "$cmd_file")
  # Replace all references to the global runtime with the fork
  # Handle both absolute path (C:/Users/...) and $HOME variable forms
  sed -e "s|$GLOBAL_RUNTIME|$FORK_RUNTIME|g" \
      -e 's|\$HOME/.claude/get-shit-done|'"$FORK_RUNTIME"'|g' \
      "$cmd_file" > "$TARGET_PROJECT/.claude/commands/gsd/$basename"
  count=$((count + 1))
done

echo ""
echo "Done! Copied $count GSD commands into:"
echo "  $TARGET_PROJECT/.claude/commands/gsd/"
echo ""
echo "Path rewrite:"
echo "  FROM: $GLOBAL_RUNTIME"
echo "  TO:   $FORK_RUNTIME"
echo ""
echo "Next steps:"
echo "  1. Open Claude Code in: $TARGET_PROJECT"
echo "  2. Run /gsd:help to verify it loads your fork"
echo "  3. Test your multi-instance changes"
echo ""
echo "Other Claude Code instances are unaffected."
