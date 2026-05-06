#!/usr/bin/env bash
TEST_NAME="validate-publish-scope"
source "$(dirname "$0")/_lib.sh"
VALIDATOR="$GSD_IC_ROOT/tools/ci/validate-publish-scope.sh"

# --- Case 1: well-formed package.json with restrictive `files` -> pass ---
fx="$(mkfixture good)"
mkdir -p "$fx/agents" "$fx/hooks" "$fx/intel-refs" "$fx/bin"
cat > "$fx/package.json" <<'JSON'
{
  "name": "@adelphi/gsd-ic",
  "version": "0.1.0",
  "files": [
    "agents/gsd-*.md",
    "hooks/gsd-*.js",
    "intel-refs/",
    "bin/gsd-ic-install.js"
  ]
}
JSON
echo "test" > "$fx/agents/gsd-x.md"
echo "stock-content" > "$fx/agents/gsd-stock-not-ours.md"  # NOTE: stock GSD also uses gsd-*. Filtering by glob includes both. The validator can't tell apart by name alone — it falls back to checking if the agent file has ic_pack: true frontmatter. (See Step 3 implementation.)
echo "test" > "$fx/hooks/gsd-x.js"
echo "test" > "$fx/intel-refs/MANIFEST.json"
echo "test" > "$fx/bin/gsd-ic-install.js"
run_validator "$VALIDATOR" "$fx"
expect_pass "valid package.json passes"

# --- Case 2: package.json `files` field includes upstream-only paths -> fail ---
fx="$(mkfixture upstream-leak)"
mkdir -p "$fx"
cat > "$fx/package.json" <<'JSON'
{
  "name": "@adelphi/gsd-ic",
  "version": "0.1.0",
  "files": [
    "agents/gsd-*.md",
    "sdk/dist/",
    "scripts/"
  ]
}
JSON
run_validator "$VALIDATOR" "$fx"
expect_fail "upstream-source path (sdk/, scripts/) in `files` is fatal"

# --- Case 3: name is wrong -> fail ---
fx="$(mkfixture wrong-name)"
cat > "$fx/package.json" <<'JSON'
{
  "name": "get-shit-done-cc",
  "version": "0.1.0",
  "files": ["agents/gsd-*.md"]
}
JSON
run_validator "$VALIDATOR" "$fx"
expect_fail "package name not @adelphi/gsd-ic is fatal"

report
