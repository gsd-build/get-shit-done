#!/usr/bin/env bash
TEST_NAME="validate-triggers"
source "$(dirname "$0")/_lib.sh"
VALIDATOR="$GSD_IC_ROOT/tools/ci/validate-triggers.sh"

# --- Case 1: no intel-gates.json anywhere -> pass ---
fx="$(mkfixture empty)"
run_validator "$VALIDATOR" "$fx"
expect_pass "no intel-gates.json passes"

# --- Case 2: intel-gates.json with trigger that resolves -> pass ---
fx="$(mkfixture good)"
mkdir -p "$fx/workflow-patches" "$fx/get-shit-done/workflows"
cat > "$fx/get-shit-done/workflows/plan-phase.md" <<MD
# plan-phase

## research-stage
stuff
MD
cat > "$fx/workflow-patches/intel-gates.template.json" <<JSON
{
  "version": 1,
  "gates": {
    "g1": { "trigger": "plan-phase.research-stage", "agent": "gsd-x" }
  }
}
JSON
run_validator "$VALIDATOR" "$fx"
expect_pass "valid trigger passes"

# --- Case 3: trigger references unknown workflow -> fail ---
fx="$(mkfixture bad-workflow)"
mkdir -p "$fx/workflow-patches"
cat > "$fx/workflow-patches/intel-gates.template.json" <<JSON
{
  "version": 1,
  "gates": {
    "g1": { "trigger": "nonexistent-workflow.some-step", "agent": "gsd-x" }
  }
}
JSON
run_validator "$VALIDATOR" "$fx"
expect_fail "unknown workflow file is fatal"

# --- Case 4: trigger references unknown step inside known workflow -> fail ---
fx="$(mkfixture bad-step)"
mkdir -p "$fx/workflow-patches" "$fx/get-shit-done/workflows"
echo "# plan-phase" > "$fx/get-shit-done/workflows/plan-phase.md"
cat > "$fx/workflow-patches/intel-gates.template.json" <<JSON
{
  "version": 1,
  "gates": {
    "g1": { "trigger": "plan-phase.no-such-step", "agent": "gsd-x" }
  }
}
JSON
run_validator "$VALIDATOR" "$fx"
expect_fail "unknown step in workflow is fatal"

report
