#!/usr/bin/env bash
TEST_NAME="validate-seamless-fork"
source "$(dirname "$0")/_lib.sh"
VALIDATOR="$GSD_IC_ROOT/tools/ci/validate-seamless-fork.sh"

# --- Case 1: no patches applied (Plan 0 baseline) -> pass ---
fx="$(mkfixture no-patches)"
mkdir -p "$fx/get-shit-done/workflows" "$fx/tools" "$fx/workflow-patches"
echo "# plan-phase" > "$fx/get-shit-done/workflows/plan-phase.md"
cat > "$fx/tools/patch-workflows.sh" <<'SH'
#!/usr/bin/env bash
# no-op
exit 0
SH
chmod +x "$fx/tools/patch-workflows.sh"
run_validator "$VALIDATOR" "$fx"
expect_pass "no-patch baseline passes"

# --- Case 2: patches present but all gates default off -> pass (semantically equiv) ---
# We simulate this by having the patch script add a CONDITIONAL skill line that
# resolves to the empty string when gates are off. The validator should consider
# such conditional-only insertions as "semantically empty diff".
fx="$(mkfixture conditional-only)"
mkdir -p "$fx/get-shit-done/workflows" "$fx/tools"
cat > "$fx/get-shit-done/workflows/plan-phase.md" <<'MD'
# plan-phase
{{IC_GATE_PLACEHOLDER}}
MD
cat > "$fx/tools/patch-workflows.sh" <<'SH'
#!/usr/bin/env bash
# Replaces the placeholder with a guarded skill call (no-op when gate disabled).
sed -i.bak 's|{{IC_GATE_PLACEHOLDER}}|<!-- IC-GATE: if config.intel_gates.foo.enabled then Skill(...) -->|' "$1/get-shit-done/workflows/plan-phase.md" 2>/dev/null || true
exit 0
SH
chmod +x "$fx/tools/patch-workflows.sh"
run_validator "$VALIDATOR" "$fx"
# When patch only inserts <!-- IC-GATE: ... --> lines, the validator considers
# the diff "semantically empty" (markdown-rendered output is unchanged).
expect_pass "comment-only patch lines pass (semantically empty)"

# --- Case 3: patch removes a stock line (forbidden) -> fail ---
fx="$(mkfixture removed-line)"
mkdir -p "$fx/get-shit-done/workflows" "$fx/tools"
cat > "$fx/get-shit-done/workflows/plan-phase.md" <<'MD'
# plan-phase
stock line that should never be removed
MD
cat > "$fx/tools/patch-workflows.sh" <<'SH'
#!/usr/bin/env bash
# Bad: removes a stock line.
sed -i.bak '/stock line that should never be removed/d' "$1/get-shit-done/workflows/plan-phase.md" 2>/dev/null || true
exit 0
SH
chmod +x "$fx/tools/patch-workflows.sh"
run_validator "$VALIDATOR" "$fx"
expect_fail "removing a stock line breaks the seamless-fork guarantee"

report
