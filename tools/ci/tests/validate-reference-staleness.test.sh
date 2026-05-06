#!/usr/bin/env bash
TEST_NAME="validate-reference-staleness"
source "$(dirname "$0")/_lib.sh"
VALIDATOR="$GSD_IC_ROOT/tools/ci/validate-reference-staleness.sh"

# --- Case 1: empty manifest -> pass, no warning ---
fx="$(mkfixture empty)"
mkdir -p "$fx/intel-refs"
echo '{"version":"2026.05","topics":{}}' > "$fx/intel-refs/MANIFEST.json"
run_validator "$VALIDATOR" "$fx"
expect_pass "empty manifest passes"

# --- Case 2: fresh entry -> pass ---
today="$(date +%Y-%m-%d)"
fx="$(mkfixture fresh)"
mkdir -p "$fx/intel-refs/int-disciplines"
echo "<!-- CLASSIFICATION: UNCLASSIFIED -->" > "$fx/intel-refs/int-disciplines/humint.md"
cat > "$fx/intel-refs/MANIFEST.json" <<JSON
{
  "version": "2026.05",
  "topics": {
    "int-disciplines/humint.md": {
      "applies_when": ["humint"],
      "owner": "alice",
      "last_reviewed": "$today",
      "classification": "UNCLASSIFIED"
    }
  }
}
JSON
run_validator "$VALIDATOR" "$fx"
expect_pass "fresh ref passes"

# --- Case 3: stale entry (8 months old) -> pass with warning ---
fx="$(mkfixture stale)"
mkdir -p "$fx/intel-refs/int-disciplines"
echo "<!-- CLASSIFICATION: UNCLASSIFIED -->" > "$fx/intel-refs/int-disciplines/humint.md"
# Date 8 months ago (use Python for portability across macOS/Linux date(1) flavors).
old_date="$(python3 -c 'from datetime import date, timedelta; print((date.today()-timedelta(days=240)).isoformat())')"
cat > "$fx/intel-refs/MANIFEST.json" <<JSON
{
  "version": "2026.05",
  "topics": {
    "int-disciplines/humint.md": {
      "applies_when": ["humint"],
      "owner": "alice",
      "last_reviewed": "$old_date",
      "classification": "UNCLASSIFIED"
    }
  }
}
JSON
run_validator "$VALIDATOR" "$fx"
expect_pass "stale ref still passes (advisory)"
expect_output "stale warning output" "WARN"

report
