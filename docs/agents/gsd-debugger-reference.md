# gsd-debugger.md — Standard Reference

## Metadata
| Attribute | Value |
|-----------|-------|
| **Type** | Agent |
| **Location** | `agents/gsd-debugger.md` |
| **Size** | 1184 lines |
| **Documentation Tier** | Standard |
| **Complexity Score** | 2+3+2+2 = **9/12** |

### Complexity Breakdown
- **Centrality: 2** — Spawned by debug command and diagnose-issues workflow
- **Complexity: 3** — Scientific method, hypothesis testing, persistent debug files, multiple phases, checkpoint handling
- **Failure Impact: 2** — Missed bugs cause issues but not critical path blocker
- **Novelty: 2** — Meta-debugging discipline, debug file protocol are GSD-specific

---

## Purpose

Investigates bugs using systematic scientific method, manages persistent debug sessions, and handles checkpoints when user input is needed. Operates as investigator (user is reporter) — gathers symptoms, forms falsifiable hypotheses, tests one at a time, maintains debug file state that survives context resets.

---

## Critical Behaviors

- **MUST create debug file IMMEDIATELY** — `.planning/debug/{slug}.md` created before any investigation
- **MUST update file BEFORE taking action** — If context resets mid-action, file shows what was happening
- **MUST test ONE hypothesis at a time** — Multiple changes = no idea what mattered
- **MUST form FALSIFIABLE hypotheses** — "Component remounts on route change" not "Something is wrong with state"
- **NEVER ask user about cause** — Ask about experience (what they saw), investigate cause yourself
- **APPEND to Eliminated section** — Prevents re-investigating disproven hypotheses after context reset

---

## Modes/Variants

| Mode | Trigger | Behavior |
|------|---------|----------|
| **find_and_fix** (default) | No flags | Find root cause, fix, verify, archive session |
| **find_root_cause_only** | `goal: find_root_cause_only` flag | Diagnose only, skip fix_and_verify, return diagnosis |
| **symptoms_prefilled** | `symptoms_prefilled: true` flag | Skip symptom gathering, start at investigation loop |

---

## Debug File Structure

```markdown
---
status: gathering | investigating | fixing | verifying | resolved
trigger: "[verbatim user input]"
created: [ISO timestamp]
updated: [ISO timestamp]
---

## Current Focus      ← OVERWRITE before every action
## Symptoms           ← IMMUTABLE after gathering
## Eliminated         ← APPEND only (prevents re-investigation)
## Evidence           ← APPEND only (facts discovered)
## Resolution         ← OVERWRITE as understanding evolves
```

---

## Investigation Techniques

| Situation | Technique |
|-----------|-----------|
| Large codebase, many files | Binary search / divide and conquer |
| Confused about what's happening | Rubber duck, Observability first |
| Complex system, many interactions | Minimal reproduction |
| Know desired output | Working backwards |
| Used to work, now doesn't | Differential debugging, Git bisect |
| Many possible causes | Comment out everything |

---

## Checkpoint Types

| Type | When | What User Does |
|------|------|----------------|
| **human-verify** | Need confirmation you can't observe | User tests and reports back |
| **human-action** | Need user action (auth, physical) | User performs action |
| **decision** | Need user to choose investigation direction | User selects option |

---

## Interactions

| Reads | Writes | Spawned By | Consumed By |
|-------|--------|------------|-------------|
| Codebase files | `.planning/debug/{slug}.md` | `/gsd:debug` | User (debug session state) |
| Test output | `.planning/debug/resolved/{slug}.md` | `diagnose-issues` workflow | |
| Error logs | Code fixes | | |

---

## Structured Returns

- **ROOT CAUSE FOUND** — (find_root_cause_only mode) Root cause, evidence summary, files involved, suggested fix direction
- **DEBUG COMPLETE** — (find_and_fix mode) Root cause, fix applied, verification, files changed, commit hash
- **INVESTIGATION INCONCLUSIVE** — What was checked, hypotheses eliminated, remaining possibilities
- **CHECKPOINT REACHED** — Type, progress, investigation state, what's needed from user

---

## Quick Reference

```
WHAT:     Scientific debugging with persistent state
MODES:    find_and_fix (default), find_root_cause_only, symptoms_prefilled
OUTPUT:   .planning/debug/{slug}.md → .planning/debug/resolved/{slug}.md

CORE RULES:
• Create debug file IMMEDIATELY, update BEFORE actions
• Test ONE hypothesis at a time (falsifiable, specific)
• APPEND to Eliminated (never re-investigate disproven theories)
• User = reporter (what they saw), You = investigator (find cause)

SPAWNED BY: /gsd:debug, diagnose-issues workflow
CONSUMED BY: User (session state persists across context resets)
```
