# GSD Artifact Types

This reference documents all artifact types in the GSD planning taxonomy. Each type has a defined
shape, lifecycle, location, and consumption mechanism. A well-formatted artifact that no workflow
reads is inert — the consumption mechanism is what gives an artifact meaning.

---

## Core Artifacts

### ROADMAP.md
- **Shape**: Milestone + phase listing with goals and canonical refs
- **Lifecycle**: Created → Updated per milestone → Archived
- **Location**: `.planning/ROADMAP.md`
- **Consumed by**: `plan-phase`, `discuss-phase`, `execute-phase`, `progress`, `state` commands

### STATE.md
- **Shape**: Current position tracker (phase, plan, progress, decisions)
- **Lifecycle**: Continuously updated throughout the project
- **Location**: `.planning/STATE.md`
- **Consumed by**: All orchestration workflows; `resume-project`, `progress`, `next` commands

### REQUIREMENTS.md
- **Shape**: Numbered acceptance criteria with traceability table
- **Lifecycle**: Created at project start → Updated as requirements are satisfied
- **Location**: `.planning/REQUIREMENTS.md`
- **Consumed by**: `discuss-phase`, `plan-phase`, CONTEXT.md generation; executor marks complete

### CONTEXT.md (per-phase)
- **Shape**: 6-section format: domain, decisions, canonical_refs, code_context, specifics, deferred
- **Lifecycle**: Created before planning → Used during planning and execution → Superseded by next phase
- **Location**: `.planning/phases/XX-name/XX-CONTEXT.md`
- **Consumed by**: `plan-phase` (reads decisions), `execute-phase` (reads code_context and canonical_refs)

### PLAN.md (per-plan)
- **Shape**: Frontmatter + objective + tasks with types + success criteria + output spec
- **Lifecycle**: Created by planner → Executed → SUMMARY.md produced
- **Location**: `.planning/phases/XX-name/XX-YY-PLAN.md`
- **Consumed by**: `execute-phase` executor; task commits reference plan IDs

### SUMMARY.md (per-plan)
- **Shape**: Frontmatter with dependency graph + narrative + deviations + self-check
- **Lifecycle**: Created at plan completion → Read by subsequent plans in same phase
- **Location**: `.planning/phases/XX-name/XX-YY-SUMMARY.md`
- **Consumed by**: Orchestrator (progress), planner (context for future plans), `milestone-summary`

### HANDOFF.json / .continue-here.md
- **Shape**: Structured pause state (JSON machine-readable + Markdown human-readable)
- **Lifecycle**: Created on pause → Consumed on resume → Replaced by next pause
- **Location**: `.planning/HANDOFF.json` + `.planning/phases/XX-name/.continue-here.md` (or spike/deliberation path)
- **Consumed by**: `resume-project` workflow

---

## Extended Artifacts

### DISCUSSION-LOG.md (per-phase)
- **Shape**: Audit trail of assumptions and corrections from discuss-phase
- **Lifecycle**: Created at discussion time → Read-only audit record
- **Location**: `.planning/phases/XX-name/XX-DISCUSSION-LOG.md`
- **Consumed by**: Human review; not read by automated workflows

### USER-PROFILE.md
- **Shape**: Calibration tier and preferences profile
- **Lifecycle**: Created by `profile-user` → Updated as preferences are observed
- **Location**: `~/.claude/get-shit-done/USER-PROFILE.md`
- **Consumed by**: `discuss-phase-assumptions` (calibration tier), `plan-phase`

### SPIKE.md / DESIGN.md (per-spike)
- **Shape**: Research question + methodology + findings + recommendation
- **Lifecycle**: Created → Investigated → Decided → Archived
- **Location**: `.planning/spikes/SPIKE-NNN/`
- **Consumed by**: Planner when spike is referenced; `pause-work` for spike context handoff

### Spike README.md / MANIFEST.md (per-spike, via /gsd-spike)
- **Shape**: YAML frontmatter (spike, name, validates, verdict, related, tags) + run instructions + results
- **Lifecycle**: Created by `/gsd-spike` → Verified → Wrapped up by `/gsd-spike-wrap-up`
- **Location**: `.planning/spikes/NNN-name/README.md`, `.planning/spikes/MANIFEST.md`
- **Consumed by**: `/gsd-spike-wrap-up` for curation; `pause-work` for spike context handoff

### Sketch README.md / MANIFEST.md / index.html (per-sketch)
- **Shape**: YAML frontmatter (sketch, name, question, winner, tags) + variants as tabbed HTML
- **Lifecycle**: Created by `/gsd-sketch` → Evaluated → Wrapped up by `/gsd-sketch-wrap-up`
- **Location**: `.planning/sketches/NNN-name/README.md`, `.planning/sketches/NNN-name/index.html`, `.planning/sketches/MANIFEST.md`
- **Consumed by**: `/gsd-sketch-wrap-up` for curation; `pause-work` for sketch context handoff

### WRAP-UP-SUMMARY.md (per wrap-up session)
- **Shape**: Curation results, included/excluded items, feature/design area groupings
- **Lifecycle**: Created by `/gsd-spike-wrap-up` or `/gsd-sketch-wrap-up`
- **Location**: `.planning/spikes/WRAP-UP-SUMMARY.md` or `.planning/sketches/WRAP-UP-SUMMARY.md`
- **Consumed by**: Project history; not read by automated workflows

---

## Standing Reference Artifacts

### METHODOLOGY.md

- **Shape**: Standing reference — reusable interpretive frameworks (lenses) that apply across phases
- **Lifecycle**: Created → Active → Superseded (when a lens is replaced by a better one)
- **Location**: `.planning/METHODOLOGY.md` (project-scoped, not phase-scoped)
- **Contents**: Named lenses, each documenting:
  - What it diagnoses (the class of problem it detects)
  - What it recommends (the class of response it prescribes)
  - When to apply (triggering conditions)
  - Example: Bayesian updating, STRIDE threat modeling, Cost-of-delay prioritization
- **Consumed by**:
  - `discuss-phase-assumptions` — reads METHODOLOGY.md (if it exists) and applies active lenses
    to the current assumption analysis before surfacing findings to the user
  - `plan-phase` — reads METHODOLOGY.md to inform methodology selection for each plan
  - `pause-work` — includes METHODOLOGY.md in the Required Reading section of `.continue-here.md`
    so resuming agents inherit the project's analytical orientation

**Why consumption matters:** A METHODOLOGY.md that no workflow reads is inert. The lenses only
take effect when an agent loads them into its reasoning context before analysis. This is why
both the discuss-phase-assumptions and pause-work workflows explicitly reference this file.

**Example lens entry:**

```markdown
## Bayesian Updating

**Diagnoses:** Decisions made with stale priors — assumptions formed early that evidence has since
contradicted, but which remain embedded in the plan.

**Recommends:** Before confirming an assumption, ask: "What evidence would make me change this?"
If no evidence could change it, it's a belief, not an assumption. Flag for user review.

**Apply when:** Any assumption carries Confident label but was formed before recent architectural
changes, library upgrades, or scope corrections.
```
