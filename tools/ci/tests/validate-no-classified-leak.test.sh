#!/usr/bin/env bash
TEST_NAME="validate-no-classified-leak"
source "$(dirname "$0")/_lib.sh"
VALIDATOR="$GSD_IC_ROOT/tools/ci/validate-no-classified-leak.sh"

# --- Case 1: clean repo passes ---
fx="$(mkfixture clean)"
echo "regular content" > "$fx/notes.md"
run_validator "$VALIDATOR" "$fx"
expect_pass "clean repo passes"

# --- Case 2: SECRET marking -> fail ---
fx="$(mkfixture secret-marking)"
echo "S//NOFORN something something" > "$fx/leak.md"
run_validator "$VALIDATOR" "$fx"
expect_fail "S// marking is fatal"
expect_output "S// in output" "S//"

# --- Case 3: TS// marking -> fail ---
fx="$(mkfixture ts-marking)"
echo "TS//SI//NOFORN" > "$fx/leak.md"
run_validator "$VALIDATOR" "$fx"
expect_fail "TS// marking is fatal"

# --- Case 4: SI// marking in a code comment -> fail ---
fx="$(mkfixture si-marking)"
echo "// SI//TK comment" > "$fx/leak.js"
run_validator "$VALIDATOR" "$fx"
expect_fail "SI// in code is fatal"

# --- Case 5: HCS marking -> fail ---
fx="$(mkfixture hcs-marking)"
echo "HCS-O//NOFORN" > "$fx/leak.md"
run_validator "$VALIDATOR" "$fx"
expect_fail "HCS marking is fatal"

# --- Case 6: lowercase 's//' is NOT a marking (legit text) -> pass ---
fx="$(mkfixture lowercase-not-marking)"
echo "URL: https://example.com (the s// is part of the URL)" > "$fx/notes.md"
run_validator "$VALIDATOR" "$fx"
expect_pass "lowercase s// is not a marking"

# --- Case 7: marking inside the validator's own fixture exclusion list -> pass ---
# (Validator should exclude tools/ci/tests/fixtures/ from the scan.)
fx="$(mkfixture excluded-fixture-dir)"
mkdir -p "$fx/tools/ci/tests/fixtures/_scratch/inside"
echo "TS//SI//NOFORN" > "$fx/tools/ci/tests/fixtures/_scratch/inside/leak.md"
echo "regular content" > "$fx/notes.md"
run_validator "$VALIDATOR" "$fx"
expect_pass "scratch fixtures are excluded from scan"

report
