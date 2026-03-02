# Deep Dive: Original GSD TDD Approach

## Strategic Summary

Original GSD had TDD as **advisory guidance, not enforcement**. The planner used a heuristic to *suggest* TDD plans, but there was no toggle, no mandatory tests for fixes, and debugging could ship without regression tests. TDD was **reactive** (applied when planner detected fit) rather than **proactive** (enforced by policy).

## Key Questions

- Did original GSD use TDD? **Yes, as guidance**
- How strict was it? **Not strict — advisory only**
- Was it proactive or reactive? **Reactive — heuristic-based detection**

---

## Overview

Original GSD had sophisticated TDD documentation and execution flows, but they were **opt-in by detection**, not **enforced by default**. The system would:

1. **Planner detects** TDD candidates using heuristic
2. **Creates TDD plan** if heuristic matches
3. **Executor runs** RED-GREEN-REFACTOR if plan has `type: tdd`
4. **Debugger ignores** TDD entirely — fixes ship without tests

There was **no user-facing toggle** to enable/disable TDD, and **no enforcement** that fixes must include tests.

---

## How Original GSD Handled TDD

### 1. Detection (Reactive, Heuristic-Based)

The planner used this heuristic:

```
Can you write `expect(fn(input)).toBe(output)` before writing `fn`?
→ Yes: Create a TDD plan
→ No: Use standard plan, add tests after if needed
```

**TDD candidates (automatic detection):**
- Business logic with defined inputs/outputs
- API endpoints with request/response contracts
- Data transformations, parsing, formatting
- Validation rules and constraints

**Skip TDD (automatic detection):**
- UI layout, styling, visual components
- Configuration changes
- Glue code, migrations
- Simple CRUD with no business logic

### 2. Execution (If Detected)

When a plan had `type: tdd`, executor ran RED-GREEN-REFACTOR:

```
RED   → Write failing test, commit
GREEN → Implement, commit
REFACTOR → Optional cleanup, commit
```

This produced 2-3 atomic commits per feature.

### 3. Debugging (No TDD)

Original debugger `fix_and_verify` step:

```markdown
**1. Implement minimal fix**
- Make SMALLEST change that addresses root cause

**2. Verify**
- Test against original Symptoms
- If PASSES: proceed to archive
```

**No mention of tests.** Fixes could ship without regression tests.

---

## What Was Missing (Your Changes Fill These Gaps)

| Gap | Original GSD | Your Changes |
|-----|--------------|--------------|
| TDD toggle | None — always heuristic | `/gsd:settings` toggle |
| Enforcement | Advisory only | Mandatory when enabled |
| Debug tests | Not required | Required before fix accepted |
| Security tests | Not mentioned | 5-level compliance framework |
| Quality verification | Task completion only | Test category + coverage checks |

---

## Strictness Analysis

### Original: LOW strictness

| Aspect | Behavior |
|--------|----------|
| Plan detection | Heuristic — could miss or wrongly apply |
| Execution | Followed if plan said `type: tdd` |
| Debugging | Zero TDD — fixes ship without tests |
| Settings | No user control |
| Enforcement | None — all advisory |

### Your Changes: HIGH strictness (when enabled)

| Aspect | Behavior |
|--------|----------|
| Plan detection | Config-driven — user controls policy |
| Execution | Enforced RED-GREEN-REFACTOR |
| Debugging | Mandatory regression test before fix |
| Settings | Toggle via `/gsd:settings` |
| Enforcement | Rejected if test missing |

---

## Proactive vs Reactive

### Original GSD: REACTIVE

```
Code exists → Planner analyzes → Detects TDD fit → Maybe creates TDD plan
```

TDD was **applied when detected**, not **enforced by policy**. The system reacted to code characteristics.

### Your Changes: PROACTIVE

```
Policy set → All plans follow policy → Tests required upfront
```

TDD is **enforced by configuration**, not **detected by heuristic**. The system proactively requires tests.

---

## Evidence from Original Code

### 1. No TDD in `/gsd:settings`

Original settings only had:
- Model profile
- Research toggle
- Plan checker toggle
- Verifier toggle

**No TDD toggle existed.**

### 2. No TDD in `/gsd:new-project`

TDD was not asked during project creation.

### 3. Debugger had no test requirement

Original `fix_and_verify`:
```markdown
**1. Implement minimal fix**
**2. Verify** - Test against original Symptoms
```

No mention of writing tests, no `test_file` tracking, no rejection without tests.

### 4. Planner used detection, not enforcement

```markdown
## TDD Detection Heuristic

For each potential task, evaluate TDD fit:
**Heuristic:** Can you write `expect(fn(input)).toBe(output)`...
```

Detection, not enforcement.

---

## Key Takeaways

1. **Original GSD had TDD infrastructure** — execution flows, commit patterns, framework setup
2. **But no enforcement** — everything was advisory, heuristic-based
3. **Debugging was the biggest gap** — fixes shipped without regression tests
4. **No user control** — couldn't toggle TDD on/off per project
5. **Your changes add enforcement layer** — TDD becomes policy, not suggestion

---

## Comparison Table

| Dimension | Original GSD | Your Fork |
|-----------|--------------|-----------|
| TDD approach | Reactive (detection) | Proactive (policy) |
| Strictness | Advisory | Mandatory (when on) |
| User control | None | `/gsd:settings` toggle |
| Debug tests | Not required | Mandatory |
| Security tests | Not mentioned | 5-level compliance |
| Verification | Task completion | Quality + coverage |

---

## Implementation Context

```yaml
application:
  when_to_use:
    - Projects requiring test discipline
    - Teams with compliance requirements
    - Codebases where bugs keep recurring
  when_not_to_use:
    - Rapid prototyping
    - Legacy code with no test infrastructure
    - Time-critical hotfixes (toggle off temporarily)
  prerequisites:
    - Test framework installed or GSD installs it
    - `.planning/config.json` exists

technical:
  patterns:
    - RED-GREEN-REFACTOR cycle
    - 4 test categories (acceptance, edge, security, performance)
    - Regression test before fix
  gotchas:
    - TDD defaults to ON — may surprise users expecting original behavior
    - Compliance level affects required tests

integration:
  works_with:
    - All GSD commands
    - Any test framework (jest, vitest, pytest, go test, cargo test)
  conflicts_with:
    - Projects with no testable logic (pure config, scripts)
  alternatives:
    - Toggle TDD off via `/gsd:settings`
    - Use `type: execute` plans manually
```

---

**Saved to:** `artifacts/research/2026-01-22-original-gsd-tdd-approach-deep-dive.md`
