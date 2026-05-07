# Plan Atomic Close-Out Invariant

> **Status:** Documented and partially enforced as of v1.50.0 (issue
> [#3212](https://github.com/gsd-build/get-shit-done/issues/3212)).
> Documentation is the contract; runtime enforcement is split across
> `agents/gsd-executor.md` (producer side) and the new `plan.consistency-check`
> SDK handler (consumer side).

When the GSD executor finishes a plan, **four artifacts must exist together**.
This document names them, defines what "together" means, and tells you what
to do if you find them out of sync.

---

## The four artifacts

For every plan `{phase}-{plan}` that the executor reports as complete:

| # | Artifact | Where it lives | What it proves |
|---|---|---|---|
| 1 | **Per-task production commits** | `git log --grep="({phase}-{plan})"` | The code changes the plan asked for actually landed |
| 2 | **`{phase}-{plan}-SUMMARY.md`** | `.planning/phases/XX-name/` | The agent finished the plan, recorded deviations, and self-checked |
| 3 | **`STATE.md` advanced** | `.planning/STATE.md` | The cursor (`Current Plan`, progress bar) reflects the plan as done |
| 4 | **`ROADMAP.md` updated** | `.planning/ROADMAP.md` | Cross-phase progress table reflects the plan as done |

The atomic close-out **commit** that lands artifacts 2–4 is a single `git commit`
created by the executor's `<final_commit>` step (`agents/gsd-executor.md` lines
659–666). It is intentionally separate from the per-task production commits so
that resume tooling can distinguish "code landed" from "plan reported done."

---

## What "atomic" means here

"Atomic" in this context is **observational**, not transactional. We cannot
make four file writes and a git commit physically atomic. Instead, the
contract is:

> **If artifact 1 (production commits) exists for a plan, then artifacts 2, 3,
> and 4 must also exist before any other GSD workflow treats that plan as
> done.**

The framework cannot prevent a partial-write at runtime (network glitch,
agent stall, kill -9). What it **does** do — newly, post-#3212 — is detect
the partial state on the next entry into a workflow and refuse to advance.

---

## Possible inconsistent states

| State | Production commits? | SUMMARY.md? | STATE advanced? | ROADMAP updated? | Meaning |
|---|---|---|---|---|---|
| **Consistent: not started** | no | no | no | no | Plan has not been executed; safe to dispatch |
| **Consistent: complete** | yes | yes | yes | yes | Plan finished cleanly; safe to advance |
| **Drift A: stalled mid-execute** | yes | no | no | no | Agent committed code, then stopped before SUMMARY. **Resume requires reconciliation** — do NOT redo. |
| **Drift B: SUMMARY without state** | yes | yes | no | no | SUMMARY landed but STATE/ROADMAP did not. Cursor still points here. **Re-run only the state-update step.** |
| **Drift C: state without SUMMARY** | yes | no | yes | yes | STATE moved on but SUMMARY is missing. **Reconstruct SUMMARY from git log; do NOT redo code.** |
| **Drift D: phantom done** | no | yes | yes | yes | SUMMARY/state say done but no code commits exist. **Investigate — likely a manually-edited STATE.md.** |

The new `plan.consistency-check` SDK handler returns one of these state names
(or `consistent`/`unknown`) so workflows can branch on the result.

---

## Producer-side responsibilities (`agents/gsd-executor.md`)

The executor agent's prose in `<execution_flow>` already orders the four
steps correctly. Post-#3212, that file also carries an explicit
`<atomic_closeout_invariant>` callout pointing here, so future edits do not
silently reorder the sequence.

The executor MUST:

1. Land all per-task production commits **first** (loop in `<execute_tasks>`).
2. Run `<self_check>` — verify code commits exist before writing SUMMARY.
3. Write **and commit** SUMMARY.md (`<summary_creation>` → per-task commit
   protocol; in worktree mode, commit happens inside the agent's own commit;
   in single-tree mode, SUMMARY.md is committed in `<final_commit>`).
4. Update STATE.md and ROADMAP.md via SDK handlers (`<state_updates>`).
5. Land the final commit covering SUMMARY + STATE + ROADMAP
   (`<final_commit>`). This single commit is what makes the close-out
   observable from outside.

If the executor returns to the orchestrator before step 5, the plan is in a
**drift** state by definition.

---

## Consumer-side responsibilities (resume / dispatch)

Any workflow that decides "is this plan done?" or "should I dispatch this
plan?" must consult `plan.consistency-check` first.

```bash
# Inspect a single plan
gsd-sdk query plan.consistency-check --phase 4 --plan 03

# Returns:
# {
#   "phase": "4",
#   "plan": "03",
#   "state": "drift_a_stalled_midexecute",
#   "production_commits": 2,
#   "summary_exists": false,
#   "state_advanced": false,
#   "roadmap_updated": false,
#   "advice": "Reconcile manually — do NOT redo code."
# }
```

The `commands/gsd/resume-work.md` flow (via `resume-project.md`'s
`check_incomplete_work` step) calls this handler for any phase whose
directory exists. Drift states surface as a blocker prompt rather than
silently re-dispatching.

---

## What changes in v1.50.0 (from #3212)

1. **This document exists** — the invariant has a single canonical home.
2. **`agents/gsd-executor.md` has an `<atomic_closeout_invariant>` block**
   pointing here.
3. **`plan.consistency-check` SDK handler** computes the table above for any
   `{phase, plan}` pair without modifying disk.
4. **`commands/gsd/resume-work.md` is wired** to call the handler before
   re-dispatching incomplete plans (the existing "PLAN without SUMMARY"
   branch is preserved as a fallback when the handler is unavailable).
5. **Optional dispatch surveillance probe** — `dispatch.commit-since` SDK
   handler. Orchestrators that want stall detection can poll
   `gsd-sdk query dispatch.commit-since --since $T0 [--plan $plan_id]` on a
   wall-clock cadence; `count == 0` means no new commits landed since $T0.
   The probe is read-only, requires no config keys, and is **complementary
   to** (not a replacement for) the existing `workflow.subagent_timeout`
   wall-clock kill switch. Existing workflows that do not call this probe
   continue to work exactly as before.

---

## Backward compatibility

All five additions are **purely additive**:

- No existing config key changes default value.
- No existing agent prompt is rewritten — only an invariant callout is added.
- No existing `gsd-sdk query` command changes its return shape.
- The new `plan.consistency-check` handler only **reads** disk and git log.
- Surveillance is opt-in and defaults to off.

A project that ignores all of this continues to work exactly as before.

---

## Related issues

- **#3212** — Executor Subagent Stall and STATE Invariant Breakdown
  (this issue: defines the three problems and the additive fix).
- **#1472** — `workflow.subagent_timeout` config key
  (the wall-clock kill switch that surveillance complements).
- **#2833** — STATE.md phase-lifecycle frontmatter
  (the read-side that visualizes plan progress; consistency-check protects
  the data this surfaces).
