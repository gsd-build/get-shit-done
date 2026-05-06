#!/usr/bin/env bash
TEST_NAME="validate-classification"
source "$(dirname "$0")/_lib.sh"
VALIDATOR="$GSD_IC_ROOT/tools/ci/validate-classification.sh"

# --- Case 1: empty repo passes ---
fx="$(mkfixture empty)"
mkdir -p "$fx/intel-refs" "$fx/config-overlays"
run_validator "$VALIDATOR" "$fx"
expect_pass "empty repo passes"

# --- Case 2: ref doc with UNCLASSIFIED frontmatter passes ---
fx="$(mkfixture good-frontmatter)"
mkdir -p "$fx/intel-refs/int-disciplines"
cat > "$fx/intel-refs/int-disciplines/humint.md" <<MD
---
classification: UNCLASSIFIED
owner: alice@adelphi.ai
---
# HUMINT
MD
run_validator "$VALIDATOR" "$fx"
expect_pass "UNCLASSIFIED frontmatter passes"

# --- Case 3: ref doc with HTML-comment classification passes ---
fx="$(mkfixture good-html-comment)"
mkdir -p "$fx/intel-refs/int-disciplines"
echo "<!-- CLASSIFICATION: UNCLASSIFIED -->" > "$fx/intel-refs/int-disciplines/geoint.md"
echo "# GEOINT" >> "$fx/intel-refs/int-disciplines/geoint.md"
run_validator "$VALIDATOR" "$fx"
expect_pass "UNCLASSIFIED HTML comment passes"

# --- Case 4: ref doc declared CUI -> fail ---
fx="$(mkfixture cui-frontmatter)"
mkdir -p "$fx/intel-refs/int-disciplines"
cat > "$fx/intel-refs/int-disciplines/sigint.md" <<MD
---
classification: CUI//SP-PRVCY
---
# bad
MD
run_validator "$VALIDATOR" "$fx"
expect_fail "CUI frontmatter is fatal"
expect_output "CUI fail mentions path" "sigint.md"

# --- Case 5: ref doc declared SECRET -> fail ---
fx="$(mkfixture secret)"
mkdir -p "$fx/intel-refs/tradecraft"
echo "<!-- CLASSIFICATION: SECRET -->" > "$fx/intel-refs/tradecraft/icd-203.md"
run_validator "$VALIDATOR" "$fx"
expect_fail "SECRET HTML comment is fatal"

# --- Case 6: ref doc with no classification declaration -> fail (every ref must declare) ---
fx="$(mkfixture undeclared)"
mkdir -p "$fx/intel-refs/int-disciplines"
echo "# undeclared" > "$fx/intel-refs/int-disciplines/osint.md"
run_validator "$VALIDATOR" "$fx"
expect_fail "undeclared classification is fatal"

# --- Case 7: customer overlay ref doc with CUI -> fail ---
fx="$(mkfixture overlay-cui)"
mkdir -p "$fx/config-overlays/nga/refs"
echo "<!-- CLASSIFICATION: CUI -->" > "$fx/config-overlays/nga/refs/nga-flavor.md"
run_validator "$VALIDATOR" "$fx"
expect_fail "overlay CUI is fatal"

report
