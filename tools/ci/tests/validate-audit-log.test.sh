#!/usr/bin/env bash
TEST_NAME="validate-audit-log"
source "$(dirname "$0")/_lib.sh"
VALIDATOR="$GSD_IC_ROOT/tools/ci/validate-audit-log.sh"

# --- Case 1: no audit log -> pass (no-op) ---
fx="$(mkfixture none)"
mkdir -p "$fx/.planning"
run_validator "$VALIDATOR" "$fx"
expect_pass "no audit log passes"

# --- Case 2: well-formed entry -> pass ---
fx="$(mkfixture good)"
mkdir -p "$fx/.planning"
cat > "$fx/.planning/audit.md" <<MD
# Audit log
2026-05-06T10:30:00Z | gsd-customer-context-mapper | ## CONTEXT MAPPING COMPLETE | .planning/intel-context.md | initial pass
2026-05-06T10:35:00Z | gsd-itar-screener | ## SCREENING COMPLETE | .planning/POAM.md | 0 findings
MD
run_validator "$VALIDATOR" "$fx"
expect_pass "well-formed entries pass"

# --- Case 3: malformed entry (missing fields) -> fail ---
fx="$(mkfixture bad)"
mkdir -p "$fx/.planning"
cat > "$fx/.planning/audit.md" <<MD
# Audit log
this is not a valid entry
MD
run_validator "$VALIDATOR" "$fx"
expect_fail "malformed entry is fatal"

# --- Case 4: comment / heading lines are skipped ---
fx="$(mkfixture comments)"
mkdir -p "$fx/.planning"
cat > "$fx/.planning/audit.md" <<MD
# Audit log
<!-- a comment -->

2026-05-06T10:30:00Z | gsd-x | ## X COMPLETE | path | notes

## A heading
2026-05-06T10:35:00Z | gsd-y | ## Y COMPLETE | path2 | notes2
MD
run_validator "$VALIDATOR" "$fx"
expect_pass "headings/comments/blank lines are skipped"

report
