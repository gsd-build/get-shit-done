#!/usr/bin/env bash
TEST_NAME="validate-completion-markers"
source "$(dirname "$0")/_lib.sh"
VALIDATOR="$GSD_IC_ROOT/tools/ci/validate-completion-markers.sh"

# --- Case 1: no IC pack agents -> pass ---
fx="$(mkfixture empty)"
mkdir -p "$fx/agents" "$fx/references"
echo "# IC Pack Agent Contracts" > "$fx/references/agent-contracts.ic-pack.md"
run_validator "$VALIDATOR" "$fx"
expect_pass "no IC pack agents passes"

# --- Case 2: agent with marker registered -> pass ---
fx="$(mkfixture registered)"
mkdir -p "$fx/agents" "$fx/references"
cat > "$fx/agents/gsd-x.md" <<MD
---
name: gsd-x
ic_pack: true
classification: UNCLASSIFIED
---
## X COMPLETE
MD
cat > "$fx/references/agent-contracts.ic-pack.md" <<MD
| agent | completion-marker | failure-marker | output artifact |
|---|---|---|---|
| gsd-x | ## X COMPLETE | | (n/a) |
MD
run_validator "$VALIDATOR" "$fx"
expect_pass "registered marker passes"

# --- Case 3: agent with marker NOT registered -> fail ---
fx="$(mkfixture unregistered)"
mkdir -p "$fx/agents" "$fx/references"
cat > "$fx/agents/gsd-y.md" <<MD
---
name: gsd-y
ic_pack: true
classification: UNCLASSIFIED
---
## Y COMPLETE
MD
echo "# IC Pack Agent Contracts (empty registry)" > "$fx/references/agent-contracts.ic-pack.md"
run_validator "$VALIDATOR" "$fx"
expect_fail "unregistered marker is fatal"
expect_output "fail names the marker" "Y COMPLETE"

# --- Case 4: registry file missing -> fail ---
fx="$(mkfixture no-registry)"
mkdir -p "$fx/agents"
cat > "$fx/agents/gsd-z.md" <<MD
---
name: gsd-z
ic_pack: true
classification: UNCLASSIFIED
---
## Z COMPLETE
MD
run_validator "$VALIDATOR" "$fx"
expect_fail "missing registry is fatal when there are IC pack agents"

report
