# GSD Canonical Artifact Registry

This directory contains the template files for every artifact that GSD workflows officially produce. The table below is the authoritative index: **if a `.planning/` root file is not listed here, `gsd-health` will flag it as W019** (unrecognized artifact).

Agents should query this file before treating a `.planning/` file as authoritative. If the file name does not appear below, it is not a canonical GSD artifact.

---

## `.planning/` Root Artifacts

These files live directly at `.planning/` — not inside phase subdirectories.

| File | Template | Produced by | Purpose |
|------|----------|-------------|---------|
| `PROJECT.md` | `project.md` | `/gsd:new-project` | Project identity, goals, requirements summary |
| `ROADMAP.md` | `roadmap.md` | `/gsd:new-milestone`, `/gsd:new-project` | Phase plan with milestones and progress tracking |
| `STATE.md` | `state.md` | `/gsd:new-project`, `/gsd:health --repair` | Current session state, active phase, last activity |
| `REQUIREMENTS.md` | `requirements.md` | `/gsd:new-milestone` | Functional requirements with traceability |
| `MILESTONES.md` | `milestone.md` | `/gsd:complete-milestone` | Log of completed milestones with accomplishments |
| `BACKLOG.md` | *(inline)* | `/gsd:add-backlog` | Pending ideas and deferred work |
| `LEARNINGS.md` | *(inline)* | `/gsd-extract-learnings`, `/gsd:execute-phase` | Phase retrospective learnings for future plans |
| `THREADS.md` | *(inline)* | `/gsd:thread` | Persistent discussion threads |
| `config.json` | `config.json` | `/gsd:new-project`, `/gsd:health --repair` | Project-specific GSD configuration |
| `CLAUDE.md` | `claude-md.md` | `/gsd-profile` | Auto-assembled Claude Code context file |

### Version-stamped artifacts (pattern: `vX.Y-*.md`)

| Pattern | Produced by | Purpose |
|---------|-------------|---------|
| `vX.Y-MILESTONE-AUDIT.md` | `/gsd:audit-milestone` | Milestone audit report before archiving |

These files are archived to `.planning/milestones/` by `/gsd:complete-milestone`. Finding them at the `.planning/` root after completion indicates the archive step was skipped.

---

## Phase Subdirectory Artifacts (`.planning/phases/NN-name/`)

These files live inside a phase directory. They are NOT checked by W019 (which only inspects the `.planning/` root).

| File Pattern | Template | Produced by | Purpose |
|-------------|----------|-------------|---------|
| `NN-MM-PLAN.md` | `phase-prompt.md` | `/gsd:plan-phase` | Executable implementation plan |
| `NN-MM-SUMMARY.md` | `summary.md` | `/gsd:execute-phase` | Post-execution summary with learnings |
| `NN-CONTEXT.md` | `context.md` | `/gsd:discuss-phase` | Scoped discussion decisions for the phase |
| `NN-RESEARCH.md` | `research.md` | `/gsd:research-phase`, `/gsd:plan-phase` | Technical research for the phase |
| `NN-VALIDATION.md` | `VALIDATION.md` | `/gsd:research-phase` (Nyquist) | Validation architecture (Nyquist method) |
| `NN-UAT.md` | `UAT.md` | `/gsd:validate-phase` | User acceptance test results |
| `NN-PATTERNS.md` | *(inline)* | `/gsd:plan-phase` (pattern mapper) | Analog file mapping for the phase |
| `NN-UI-SPEC.md` | `UI-SPEC.md` | `/gsd:ui-phase` | UI design contract |
| `NN-SECURITY.md` | `SECURITY.md` | `/gsd:secure-phase` | Security threat model |
| `NN-AI-SPEC.md` | `AI-SPEC.md` | `/gsd:ai-integration-phase` | AI integration spec with eval strategy |
| `NN-DEBUG.md` | `DEBUG.md` | `/gsd:debug` | Debug session log |
| `NN-REVIEWS.md` | *(inline)* | `/gsd:review` | Cross-AI review feedback |

---

## Milestone Archive (`.planning/milestones/`)

Files archived by `/gsd:complete-milestone`. These are never checked by W019.

| File Pattern | Source |
|-------------|--------|
| `vX.Y-ROADMAP.md` | Snapshot of ROADMAP.md at milestone close |
| `vX.Y-REQUIREMENTS.md` | Snapshot of REQUIREMENTS.md at milestone close |
| `vX.Y-MILESTONE-AUDIT.md` | Moved from `.planning/` root |
| `vX.Y-phases/` | Archived phase directories (if `--archive-phases` used) |

---

## Adding a New Canonical Artifact

When a new workflow produces a `.planning/` root file:

1. Add the file name to `CANONICAL_EXACT` in `get-shit-done/bin/lib/artifacts.cjs`
2. Add a row to the **`.planning/` Root Artifacts** table above
3. Add the template to `get-shit-done/templates/` if one exists
