#!/usr/bin/env bash
TEST_NAME="validate-agents"
source "$(dirname "$0")/_lib.sh"
VALIDATOR="$GSD_IC_ROOT/tools/ci/validate-agents.sh"

# --- Case 1: no IC agents -> pass (trivially) ---
fx="$(mkfixture empty)"
mkdir -p "$fx/agents"
run_validator "$VALIDATOR" "$fx"
expect_pass "no IC agents passes trivially"

# --- Case 2: well-formed IC agent passes ---
fx="$(mkfixture good)"
mkdir -p "$fx/agents"
cat > "$fx/agents/gsd-sample.md" <<MD
---
name: gsd-sample
description: A sample IC pack agent for testing.
ic_pack: true
classification: UNCLASSIFIED
tools: [Read, Write, Bash]
---
# Sample Agent

Role: do the thing.

## Execution flow

1. Read context.
2. Do work.
3. Emit completion marker.

## Completion marker

## SAMPLE COMPLETE
MD
run_validator "$VALIDATOR" "$fx"
expect_pass "well-formed IC agent passes"

# --- Case 3: agent missing frontmatter -> fail ---
fx="$(mkfixture no-frontmatter)"
mkdir -p "$fx/agents"
cat > "$fx/agents/gsd-bad.md" <<MD
# Bad Agent
no frontmatter
MD
# Mark it as IC pack via path naming (the validator should still notice the missing frontmatter
# and fail); add another good agent so there's content to inspect.
run_validator "$VALIDATOR" "$fx"
# This one is ambiguous — without frontmatter, validator can't tell it's IC pack. We require
# IC pack agents to be marked. So an agent with NO frontmatter and a gsd- prefix is treated
# as IC pack and failed.
expect_fail "missing frontmatter on gsd-* agent is fatal"

# --- Case 4: agent missing completion marker -> fail ---
fx="$(mkfixture no-marker)"
mkdir -p "$fx/agents"
cat > "$fx/agents/gsd-no-marker.md" <<MD
---
name: gsd-no-marker
ic_pack: true
classification: UNCLASSIFIED
---
# No marker
MD
run_validator "$VALIDATOR" "$fx"
expect_fail "missing completion marker is fatal"
expect_output "marker error mentions filename" "gsd-no-marker"

# --- Case 5: agent missing classification -> fail ---
fx="$(mkfixture no-class)"
mkdir -p "$fx/agents"
cat > "$fx/agents/gsd-no-class.md" <<MD
---
name: gsd-no-class
ic_pack: true
---
# No classification

## NO CLASS COMPLETE
MD
run_validator "$VALIDATOR" "$fx"
expect_fail "missing classification frontmatter is fatal"

# --- Case 6: stock GSD agent (no gsd- prefix? no — stock agents also use gsd- prefix.
# Distinguishing key is the ic_pack: true frontmatter field. A file without it is not ours
# and we don't validate it. Verify we ignore non-IC-pack agents.) ---
fx="$(mkfixture stock-coexists)"
mkdir -p "$fx/agents"
cat > "$fx/agents/gsd-planner.md" <<MD
---
name: gsd-planner
description: Stock GSD planner.
---
# Stock GSD planner — not ours, validator should ignore.
MD
run_validator "$VALIDATOR" "$fx"
expect_pass "stock GSD agents (no ic_pack flag) are ignored"

report
