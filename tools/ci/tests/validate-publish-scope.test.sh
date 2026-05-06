#!/usr/bin/env bash
TEST_NAME="validate-publish-scope"
source "$(dirname "$0")/_lib.sh"
VALIDATOR="$GSD_IC_ROOT/tools/ci/validate-publish-scope.sh"

# --- Case 1: well-formed package.json with restrictive `files` -> pass ---
# Per the Task 28 smoke-test deviation: `agents/gsd-*` and `hooks/gsd-*` globs
# are NOT allowed in `files` because npm pack can't distinguish IC-pack content
# from upstream stock by filename alone. Plan 0 ships zero agents/hooks.
fx="$(mkfixture good)"
mkdir -p "$fx/intel-refs" "$fx/bin/lib/gsd-ic"
cat > "$fx/package.json" <<'JSON'
{
  "name": "@adelphi/gsd-ic",
  "version": "0.1.0",
  "files": [
    "intel-refs/",
    "bin/gsd-ic-install.js",
    "bin/lib/gsd-ic/",
    "VERSION",
    "README.md"
  ]
}
JSON
echo "test" > "$fx/intel-refs/MANIFEST.json"
echo "test" > "$fx/bin/gsd-ic-install.js"
echo "test" > "$fx/bin/lib/gsd-ic/parse-args.cjs"
echo "pack: 0.1.0" > "$fx/VERSION"
echo "# ic pack" > "$fx/README.md"
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
expect_fail "upstream-source path (agents/gsd-*, sdk/, scripts/) in files is fatal"

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
