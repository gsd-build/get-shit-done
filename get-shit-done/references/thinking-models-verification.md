# Thinking Models: Verification Cluster

Structured reasoning models for the **verifier** and **plan-checker** agents. Apply these during verification passes, not continuously. Each model counters a specific documented failure mode.

Source: Curated from [thinking-partner](https://github.com/mattnowdev/thinking-partner) model catalog (150+ models). Selected for direct applicability to GSD verification workflow.

## Conflict Resolution

**Inversion** and **Confirmation Bias Counter** both look for failures but serve different purposes. Run them in sequence:

1. **Inversion FIRST** (brainstorm): generate 3 ways this could be wrong
2. **Confirmation Bias Counter SECOND** (structured check): find one partial requirement, one misleading test, one uncovered error path

Inversion generates the list; Confirmation Bias Counter is the discipline to verify items on it.

## 1. Inversion

**Counters:** Verifiers confirming success rather than finding failures.

Instead of checking what IS correct, list 3 specific ways this implementation could be WRONG despite passing tests: missing edge cases, silent data loss, race conditions, unhandled error paths. For each, write a concrete check (grep for pattern, test with specific input, verify error handling exists). Additionally, check whether any documented DEVIATION in SUMMARY.md changes the meaning or applicability of a must-have. If a must-have was written assuming approach A but the executor used approach B, the must-have may need reinterpretation, not literal checking.

## 2. Chesterton's Fence

**Counters:** Flagging purposeful code as dead or unnecessary.

Before flagging any existing code as dead, redundant, or overcomplicated, determine WHY it was written that way. Check git blame, comments, test cases, and the PLAN.md that created it. If the reason is unclear, flag as "purpose unknown -- recommend keeping with WARNING, not removing" and include the git blame hash for the commit that introduced it.

## 3. Confirmation Bias Counter

**Counters:** Verifiers primed by SUMMARY.md claims to see success.

After your initial verification pass, do a DISCONFIRMATION pass: (1) find one requirement that is only partially met, (2) find one test that passes but does not actually test the stated behavior, (3) find one error path that has no test coverage. Report these even if overall verification passes.

## 4. Planning Fallacy Calibration

**Counters:** Accepting over-scoped plans as reasonable (plan-checker).

For each task estimated as "simple" or "small", check: does it touch more than 2 files? Does it require understanding an unfamiliar API? Does it modify shared infrastructure? If yes to any, flag as likely underestimated. Plans with >5 tasks or tasks touching >4 files per task are over-scoped.

## 5. Counterfactual Thinking

**Counters:** Plans that assume success at every step with no error recovery (plan-checker).

For each plan, ask: "What would happen if the executor followed this plan EXACTLY as written but encountered a common failure: dependency version mismatch, API returning unexpected format, file already modified by prior plan?" If the plan has no contingency path and the `<action>` steps assume success at every point, flag as WARNING: "No error recovery path for task T{n}."

---

## When NOT to Think

Skip structured reasoning models when the situation does not benefit from them:

- **Re-verification of previously passed items** -- When in re-verification mode, items that passed the initial check only need a quick regression check (existence + basic sanity), not the full Inversion + Confirmation Bias Counter treatment.
- **Binary existence checks** -- If a must-have is "file X exists with >N lines" and the file clearly exists with substantive content, do not run Counterfactual Thinking on it. Reserve models for ambiguous or wiring-dependent must-haves.
- **Straightforward test results** -- If `<verify>` commands produce clear pass/fail output (e.g., test suite exits 0 with all tests passing), accept the result. Only invoke models when test results are ambiguous or when you suspect the tests do not actually test what they claim.
- **INFO-level issues** -- Do not apply structured reasoning to decide whether an INFO-level observation is actually a BLOCKER. INFO items are informational by definition and never trigger gates.
