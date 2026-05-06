#!/usr/bin/env bash
TEST_NAME="validate-skills"
source "$(dirname "$0")/_lib.sh"
VALIDATOR="$GSD_IC_ROOT/tools/ci/validate-skills.sh"

# --- Case 1: no IC skills -> pass ---
fx="$(mkfixture empty)"
mkdir -p "$fx/skills"
run_validator "$VALIDATOR" "$fx"
expect_pass "no IC skills passes"

# --- Case 2: well-formed IC skill passes ---
fx="$(mkfixture good)"
mkdir -p "$fx/skills/intel-coding-conventions"
cat > "$fx/skills/intel-coding-conventions/SKILL.md" <<MD
---
name: intel-coding-conventions
description: IC coding conventions skill.
ic_pack: true
classification: UNCLASSIFIED
---
# Intel coding conventions
MD
run_validator "$VALIDATOR" "$fx"
expect_pass "well-formed IC skill passes"

# --- Case 3: skill missing SKILL.md -> fail ---
fx="$(mkfixture no-skill-md)"
mkdir -p "$fx/skills/intel-coding-conventions"
# IC pack skill name list is hardcoded in the validator (the four named skills from spec §7).
run_validator "$VALIDATOR" "$fx"
expect_fail "IC skill directory missing SKILL.md is fatal"

# --- Case 4: skill SKILL.md missing classification -> fail ---
fx="$(mkfixture no-class)"
mkdir -p "$fx/skills/prototyping-discipline"
cat > "$fx/skills/prototyping-discipline/SKILL.md" <<MD
---
name: prototyping-discipline
ic_pack: true
---
# Bad
MD
run_validator "$VALIDATOR" "$fx"
expect_fail "missing classification frontmatter is fatal"

# --- Case 5: stock GSD skill (not in IC pack list) -> ignored ---
fx="$(mkfixture stock-skill-coexists)"
mkdir -p "$fx/skills/some-stock-skill"
cat > "$fx/skills/some-stock-skill/SKILL.md" <<MD
---
name: some-stock-skill
description: Stock GSD skill.
---
# Stock
MD
run_validator "$VALIDATOR" "$fx"
expect_pass "stock GSD skills (not in IC pack list) are ignored"

report
