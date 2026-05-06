#!/usr/bin/env bash
# Tests for tools/ci/validate-manifest.sh
TEST_NAME="validate-manifest"
source "$(dirname "$0")/_lib.sh"

VALIDATOR="$GSD_IC_ROOT/tools/ci/validate-manifest.sh"

# --- Case 1: empty manifest passes ---
fx="$(mkfixture empty-manifest)"
mkdir -p "$fx/intel-refs"
cat > "$fx/intel-refs/MANIFEST.json" <<JSON
{ "version": "2026.05", "topics": {} }
JSON
run_validator "$VALIDATOR" "$fx"
expect_pass "empty manifest passes"

# --- Case 2: no manifest at all -> fail (manifest is required) ---
fx="$(mkfixture no-manifest)"
mkdir -p "$fx/intel-refs"
run_validator "$VALIDATOR" "$fx"
expect_fail "missing manifest is fatal"
expect_output "missing manifest output" "MANIFEST.json"

# --- Case 3: manifest references a file that does not exist -> fail ---
fx="$(mkfixture missing-file)"
mkdir -p "$fx/intel-refs"
cat > "$fx/intel-refs/MANIFEST.json" <<JSON
{
  "version": "2026.05",
  "topics": {
    "int-disciplines/humint.md": {
      "applies_when": ["humint"],
      "owner": "alice@adelphi.ai",
      "last_reviewed": "2026-04-15",
      "classification": "UNCLASSIFIED"
    }
  }
}
JSON
run_validator "$VALIDATOR" "$fx"
expect_fail "missing referenced file is fatal"
expect_output "missing-file error mentions path" "humint.md"

# --- Case 4: manifest entry missing required field -> fail ---
fx="$(mkfixture bad-shape)"
mkdir -p "$fx/intel-refs/int-disciplines"
echo "<!-- CLASSIFICATION: UNCLASSIFIED -->" > "$fx/intel-refs/int-disciplines/humint.md"
cat > "$fx/intel-refs/MANIFEST.json" <<JSON
{
  "version": "2026.05",
  "topics": {
    "int-disciplines/humint.md": {
      "applies_when": ["humint"]
    }
  }
}
JSON
run_validator "$VALIDATOR" "$fx"
expect_fail "missing required field (owner/last_reviewed/classification) is fatal"

# --- Case 5: malformed JSON -> fail ---
fx="$(mkfixture malformed-json)"
mkdir -p "$fx/intel-refs"
echo "{ this is not json" > "$fx/intel-refs/MANIFEST.json"
run_validator "$VALIDATOR" "$fx"
expect_fail "malformed JSON is fatal"

# --- Case 6: well-formed manifest with one valid entry -> pass ---
fx="$(mkfixture happy-path)"
mkdir -p "$fx/intel-refs/int-disciplines"
echo "<!-- CLASSIFICATION: UNCLASSIFIED -->" > "$fx/intel-refs/int-disciplines/humint.md"
cat > "$fx/intel-refs/MANIFEST.json" <<JSON
{
  "version": "2026.05",
  "topics": {
    "int-disciplines/humint.md": {
      "applies_when": ["humint"],
      "owner": "alice@adelphi.ai",
      "last_reviewed": "2026-04-15",
      "classification": "UNCLASSIFIED"
    }
  }
}
JSON
run_validator "$VALIDATOR" "$fx"
expect_pass "well-formed manifest with valid entry passes"

report
