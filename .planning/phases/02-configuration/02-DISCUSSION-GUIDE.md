# Phase 2: Configuration - Discussion Guide

**Researched:** 2026-02-02
**Domain:** Configuration Schema Design

## Key Decision Areas

### Config Structure
- **Why it matters:** Determines how users find adversary settings and how they relate to existing workflow settings. Affects cognitive load and consistency with existing patterns.
- **Typical options:**
  - **Top-level section** — `"adversary": { ... }` at root level, like `parallelization` and `gates`
    - Pro: Easy to find, clear ownership
    - Con: Another top-level section to remember
  - **Inside `workflow` section** — Alongside `research`, `plan_check`, `verifier`
    - Pro: Groups all optional agents together, consistent pattern
    - Con: May bury adversary settings if deeply nested
  - **Hybrid** — Top-level toggle + workflow integration
    - Pro: Flexibility, clear enable/disable at top
    - Con: Settings in two places, potential confusion
- **Key question:** "Should adversary settings live at the top level or inside the workflow section?"
- **Coverage indicator:** User specified config location preference (top-level, workflow, or hybrid)

### Global Toggle Design
- **Why it matters:** Users need a simple way to turn adversary on/off without deleting all their checkpoint preferences. The design affects ease of use and CLI override potential.
- **Typical options:**
  - **Boolean flag** — `"adversary": true` or `"adversary": false` at top level
    - Pro: Simplest possible toggle, easy CLI override
    - Con: All settings lost if we need more later; mixing boolean and object feels inconsistent
  - **Object with `enabled` key** — `"adversary": { "enabled": true, ... }`
    - Pro: Extensible, keeps all settings together, clear pattern
    - Con: More verbose for simple enable/disable
  - **No global toggle** — Per-checkpoint only, no master switch
    - Pro: Fine-grained control, forces explicit choices
    - Con: Tedious to turn all on/off, no quick kill switch
- **Key question:** "Should there be a single master toggle for adversary, or only per-checkpoint toggles?"
- **Coverage indicator:** User chose global toggle approach (boolean, object with enabled, or per-checkpoint only)

### Checkpoint Granularity
- **Why it matters:** Different checkpoints have different value propositions. Users may want adversary for plans but not requirements, or vice versa.
- **Typical options:**
  - **All 4 independently toggleable** — requirements, roadmap, plan, verification each have own flag
    - Pro: Maximum flexibility, users control exactly when adversary runs
    - Con: More settings to understand and configure
  - **Grouped by workflow** — project-level (requirements + roadmap) vs execution-level (plan + verification)
    - Pro: Simpler mental model, fewer decisions
    - Con: Less granular, may force unwanted adversary runs
  - **Defaults with opt-out** — All on by default, user disables specific ones
    - Pro: Adversary runs everywhere unless explicitly disabled
    - Con: May be intrusive for users who want selective use
  - **Defaults with opt-in** — All off by default, user enables specific ones
    - Pro: Adversary is additive, no surprise interruptions
    - Con: Reduces value if users never discover checkpoints
- **Key question:** "Should users toggle each checkpoint independently, or group them? Default on or default off?"
- **Coverage indicator:** User specified granularity (individual vs grouped) and default state (opt-in vs opt-out)

### Max Rounds Configuration
- **Why it matters:** More rounds = more thorough review but higher token cost and time. Users need to balance quality vs efficiency.
- **Typical options:**
  - **Global max_rounds** — Single value applies to all checkpoints
    - Pro: Simple, one number to think about
    - Con: Can't tune per-checkpoint (plans may need more rounds than requirements)
  - **Per-checkpoint max_rounds** — Each checkpoint has own limit
    - Pro: Fine-grained tuning, optimize for each artifact type
    - Con: More complexity, users may not know good values
  - **Global with per-checkpoint override** — Default max_rounds + optional checkpoint-specific overrides
    - Pro: Simple default with power-user flexibility
    - Con: Inheritance logic to understand
- **Key question:** "Should max rounds be a single global setting or configurable per checkpoint?"
- **Coverage indicator:** User chose rounds configuration style (global, per-checkpoint, or global with overrides)

### Default Values
- **Why it matters:** Defaults determine the out-of-box experience. Too aggressive = annoyance; too conservative = missed value.
- **Typical options:**
  - **Adversary off by default** — Users must explicitly enable
    - Pro: Non-intrusive, backwards compatible, users discover intentionally
    - Con: Most users may never enable, reducing overall value
  - **Adversary on by default** — Users must explicitly disable
    - Pro: Users get adversary review automatically, higher quality artifacts
    - Con: Token cost increase, workflow interruption, may frustrate power users
  - **On for new projects, off for existing** — Migration-friendly approach
    - Pro: New projects get full value, existing projects unaffected
    - Con: Implementation complexity, version detection needed
  - **Interactive during setup** — Ask during /gsd:new-project workflow preferences
    - Pro: User makes explicit choice, no surprise
    - Con: Another question in already-long setup flow
- **Key question:** "Should adversary be enabled by default for new projects?"
- **Coverage indicator:** User specified default preference (on, off, or ask during setup)

### Round Count Defaults
- **Why it matters:** The hardcoded "max 3 rounds" in the agent needs to become configurable. Default value affects thoroughness vs speed.
- **Typical options:**
  - **Conservative (2 rounds)** — Initial challenge + one revision
    - Pro: Fast, low token cost, sufficient for simple artifacts
    - Con: May miss issues that need more iteration
  - **Standard (3 rounds)** — Current hardcoded behavior
    - Pro: Balanced, allows challenge -> defense -> final assessment
    - Con: May be overkill for simple phases
  - **Thorough (4+ rounds)** — Extended debate for high-stakes artifacts
    - Pro: Maximum issue surfacing, good for critical decisions
    - Con: High token cost, diminishing returns
- **Key question:** "What should the default max rounds be? 2, 3, or higher?"
- **Coverage indicator:** User specified default round count

## Domain Best Practices

- **Sensible defaults** — Every configurable option should have a meaningful default so users can use adversary without configuring anything
- **Precedence hierarchy** — Follow established pattern: command-line flags > environment variables > project config > system defaults
- **Consistency with existing schema** — Adversary config should feel like it belongs in config.json, using same patterns as existing sections
- **Non-breaking addition** — Adding adversary config should not require changes to existing config.json files (backwards compatible)
- **Single source of truth** — Avoid having the same setting in multiple places; if it must exist in two places, make inheritance explicit

## Common Mistakes

- **Deeply nested settings** — Question: "Can users find adversary settings without consulting documentation?"
- **Boolean-that-becomes-object** — Question: "If `adversary: true` later needs to become `adversary: { enabled: true, ... }`, how do we migrate?"
- **Inconsistent defaults per checkpoint** — Question: "Is there a good reason for different checkpoints to have different defaults?"
- **No quick disable** — Question: "Can a user quickly turn off adversary without deleting their checkpoint preferences?"
- **Config drift between workflow sections** — Question: "Will users understand why some toggles are in `workflow` and some are in `adversary`?"

## Suggested Question Flow

1. **Start with:** Config Structure — foundational, affects how all other decisions are expressed in schema
2. **Then:** Global Toggle Design — determines if adversary can be quickly enabled/disabled
3. **Then:** Checkpoint Granularity — determines what users can control individually
4. **Then:** Max Rounds Configuration — determines how debate behavior is tuned
5. **Then:** Default Values — determines out-of-box experience
6. **Finally:** Round Count Defaults — refines the specific values

---

*Phase: 02-configuration*
*Guide generated: 2026-02-02*
