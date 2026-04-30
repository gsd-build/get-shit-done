# STATE.md Phase Lifecycle Frontmatter

> **Status:** Reference for the phase-lifecycle status-line proposed in
> [issue #2833](https://github.com/gsd-build/get-shit-done/issues/2833).
> The status-line hook (`hooks/gsd-statusline.js`) reads the fields below;
> SDK write-side support to maintain them is tracked separately.

GSD's `STATE.md` carries YAML frontmatter that the status-line hook reads on
every render. This document describes the **phase-lifecycle fields** and the
rendering scenes they trigger.

All four lifecycle fields are **optional and additive**. Existing `STATE.md`
files (without these fields) keep rendering exactly as they did before — no
visual change, no migration required.

---

## Frontmatter fields

```yaml
---
gsd_state_version: 1.0
milestone: v2.0                  # existing
milestone_name: Code Quality     # existing
status: in_progress              # existing — see "status semantics" below

# Phase-lifecycle additions (issue #2833) — all optional
active_phase: null               # phase number when an orchestrator is in flight
next_action: execute-phase       # next recommended command when idle
next_phases: ["4.5"]             # phases that next_action applies to (1-2 ids)

progress:                        # nested block (existing key, percent now opt-in for the bar)
  total_phases: 17
  completed_phases: 10
  percent: 59
---
```

### Field reference

| Field | Type | When populated | When null/absent |
|---|---|---|---|
| `active_phase` | string (e.g. `"4.5"`) | An orchestrator command is in flight on this phase | Idle between phases |
| `next_action` | string | Idle, with a recommended command (`discuss-phase` / `plan-phase` / `execute-phase` / `verify-phase`) | An orchestrator is in flight, OR no recommendation available |
| `next_phases` | YAML flow array (e.g. `["4.5"]`) | Goes with `next_action` — phases the action applies to | Same as above |
| `progress.percent` | integer 0-100 | Milestone progress in **phase dimension** (`completed_phases / total_phases`) | Bar rendering is opt-in — absent → no bar |

### `next_phases` parser scope

Only **single-line YAML flow** is parsed: `next_phases: ["4.5", "4.6"]`.

Block sequences over multiple lines (`- 4.5\n - 4.6`) are intentionally
**not parsed** — the status-line only needs the primary recommendation, and a
single-line array keeps the regex-based parser predictable. If a project needs
to track many candidate next phases for documentation purposes, store the
extra ones in the `STATE.md` body.

### `progress.percent` dimension

The bar rendered next to the milestone version reflects **phase completion**
(`completed_phases / total_phases`), not plan completion.

Plan dimension (`completed_plans / total_plans`) trends optimistic for any
project where future phases haven't been planned yet — `total_plans` only
counts plans inside *already-planned* phases, so the denominator is
structurally smaller than reality. Reporting that number to stakeholders
overstates progress.

If a project wants to show plan-level progress somewhere, store it elsewhere
in frontmatter or the body — the status-line bar is reserved for the
phase-dimension number that matches `ROADMAP.md` progress tables and
`MILESTONES.md`.

---

## Status-line rendering scenes

`formatGsdState()` checks the lifecycle fields in the order below and emits
the **first matching scene**. If none match, the renderer falls through to
the original `<status> · <phase>` format (byte-for-byte unchanged from
v1.38.x).

| Scene | Trigger | Display |
|---|---|---|
| **1. Phase active** | `active_phase` populated | `v2.0 [██░░░] X% · Phase 4.5 executing` |
| **2. Idle, next recommended** | `active_phase` null AND `next_action` + `next_phases` populated | `v2.0 [██░░░] X% · next execute-phase 4.5` |
| **3. Milestone complete** | `percent: 100` OR `completed_phases == total_phases` | `v2.0 [██████████] 100% · milestone complete` |
| **4. Default fallback** | None of the above | `v1.9 Code Quality · executing · ph (1/5)` (existing format) |

### Scene priority example

When both `active_phase` and `next_action` are populated, **Scene 1 wins** —
an orchestrator is in flight, so any "next recommendation" would be misleading.
This is enforced by check order in `formatGsdState()` and by tests in
`tests/enh-2833-phase-lifecycle-statusline.test.cjs` (suite *"scene priority"*).

### Stage labels in Scene 1

In Scene 1, the second part of `Phase 4.5 <stage>` is whichever value is in
the `status` field at that moment. The convention proposed in issue #2833
is to use the lifecycle stage:

| Command | `status` value while in flight |
|---|---|
| `/gsd-discuss-phase` | `discussing` |
| `/gsd-plan-phase` | `planning` |
| `/gsd-execute-phase` | `executing` |
| `/gsd-verify-phase` | `verifying` |

If `status` is left at `in_progress` (the milestone-level value), Scene 1
renders just `Phase 4.5` without the stage suffix.

---

## Frontmatter parsing constraints

The status-line hook uses regex-based parsing (no full YAML library), so a
few constraints apply:

1. **Frontmatter must start at the very first character of the file.**
   Anything (including comments) above the opening `---` invalidates the
   match. The opening `---` line must be exactly that — no trailing spaces.

2. **Comments inside nested blocks are not supported.**
   The parser for `progress:` requires the next line to be `[ \t]+\w+:` —
   inserting `# comment` between `progress:` and the first key breaks the
   match and the bar disappears. Put any documentation in the body of
   `STATE.md`, not inside frontmatter blocks.

3. **`next_phases` accepts only single-line flow format.**
   See the parser scope note above.

These constraints are tested in
`tests/enh-2833-phase-lifecycle-statusline.test.cjs`. If a future change
swaps the regex parser for a real YAML library, the constraints can be
relaxed and the tests updated accordingly.

---

## Backward compatibility

This document describes additive fields. The promise is:

- A `STATE.md` file with **none** of the lifecycle fields populated renders
  **byte-for-byte identically** to v1.38.x and earlier.
- Adding any lifecycle field is **opt-in per project** — the renderer falls
  through to the existing format when fields are absent.
- The progress bar is opt-in even when `progress` block exists — only
  `progress.percent` triggers the bar; `total_phases` / `completed_phases`
  alone don't.

The `formatGsdState #2833 backward compatibility` test suite locks this
guarantee in: any change that breaks legacy `STATE.md` rendering will fail
the suite.

---

## Related issues / PRs

- **#1989** — *enhancement: surface GSD state in statusline.* The foundation
  this proposal extends. Established that `STATE.md` frontmatter drives the
  status-line.
- **#2833** — *enhancement: phase-lifecycle status-line — auto-rotate
  STATE.md frontmatter as phase orchestrators progress.* This document
  describes the read-side spec from that issue. Write-side SDK / workflow
  changes to auto-maintain the fields are tracked separately so each piece
  can be reviewed independently.

Companion read-side issues this proposal also helps close (each fixed a
specific symptom of the same gap):

- #1102 — STATE.md frontmatter plan counts only update on plan completion
- #1103 — STATE.md status / last_activity not updated when a phase starts
- #1446 / #1572 — phase complete doesn't update Plans column
- #612 — ROADMAP.md not updating
- #956 — planning document drift across core workflows
- #2018 — verify-work doesn't auto-transition (fixed for verify only)
