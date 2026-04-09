# Thinking Models: Execution Cluster

Structured reasoning models for the **executor** agent. Apply these at decision points during task execution, not continuously. Each model counters a specific documented failure mode.

Source: Curated from [thinking-partner](https://github.com/mattnowdev/thinking-partner) model catalog (150+ models). Selected for direct applicability to GSD execution workflow.

## Conflict Resolution

**Forcing Function and First Principles both push toward "do it now".** Run First Principles FIRST (understand the constraint), Forcing Function SECOND (create the mechanism). Sequential, not competing.

## 1. Circle of Concern vs Circle of Control

**Counters:** Executor trying to fix things outside its scope -- upstream bugs, unrelated tech debt, infrastructure issues.

Before modifying any code not explicitly listed in the plan's `<files>` section, ask: Is this in my Circle of Control (plan scope) or my Circle of Concern (things I notice but shouldn't fix)? If Circle of Concern: document it as a deviation note or deferred item, do NOT fix it. The executor's job is to build what the plan says, not to improve the codebase. Scope creep from "while I'm here" fixes is the #1 cause of executor overruns.

## 2. Forcing Function

**Counters:** Deferring hard decisions to runtime instead of resolving them at build time.

When you encounter an ambiguous requirement or unclear integration point, create a forcing function that makes the decision explicit NOW rather than hiding it behind a TODO or runtime check. Examples: use a TypeScript `never` type to force exhaustive switches, add a build-time assertion for required config values, create an interface that forces callers to handle error cases. If a decision truly cannot be made at build time, document it as a `checkpoint:decision` deviation -- do not silently defer.

## 3. First Principles Thinking

**Counters:** Copying patterns from existing code without understanding whether they fit the current task.

Before copying a pattern from another file or phase, decompose WHY that pattern exists: What constraint does it satisfy? Does your current task have the same constraint? If not, the pattern may be cargo cult. Build your implementation from the task's actual requirements, not from the nearest existing example. When in doubt, the plan's `<action>` steps define what to build -- derive the implementation from those, not from adjacent code.

## 4. Occam's Razor

**Counters:** Over-engineering simple tasks with unnecessary abstractions, generics, or future-proofing.

Before adding an abstraction layer, generic type parameter, factory pattern, or configuration option, ask: Does the plan REQUIRE this flexibility? If the plan says "create a function that does X", create a function that does X -- not a configurable, extensible, pluggable framework that could theoretically do X through Y through Z. The simplest implementation that satisfies the plan's `<done>` condition is the correct one. Add complexity only when the plan explicitly calls for it.

## 5. Chesterton's Fence

**Counters:** Removing or modifying existing code without understanding why it was written that way.

Before removing, replacing, or significantly modifying existing code that the plan touches, determine WHY it exists. Check: git blame for the commit that introduced it, comments explaining the rationale, test cases that exercise it, the PLAN.md or SUMMARY.md that created it. If the purpose is unclear, keep it and add a comment noting the uncertainty -- do NOT remove code whose purpose you don't understand. If the plan explicitly says to remove it, still document what it did in the deviation notes.

---

## When NOT to Think

Skip structured reasoning models when the situation does not benefit from them:

- **Straightforward task actions** -- If the plan says "create file X with content Y" and the action is unambiguous, execute it directly. Do not invoke First Principles to analyze why you are creating a file the plan told you to create.
- **Following established project patterns** -- If the codebase has a clear, consistent pattern (e.g., every route handler follows the same structure) and the plan says to add another one, follow the pattern. Chesterton's Fence applies to removing patterns, not to following them.
- **Trivial file edits** -- Adding an import, fixing a typo, updating a version number. These are mechanical changes that do not involve design decisions.
- **Running verify commands** -- Executing the plan's `<verify>` steps is procedural. Only invoke models if a verify step fails and you need to decide how to respond.
