---
type: Fixed
pr: 3498
---
**`state complete-phase` now syncs all phase-status display surfaces** — previously only updated Status / Last activity scalars, leaving the milestone phase-queue table inside STATE.md, the `## Current Position` progress line + ASCII bar, and the `.planning/ROADMAP.md` Progress Table all stuck on "Not started" / "In Progress" forever. Same fix mirrored into `phase complete` for parity. Pre-existing checkbox-suffix duplication on repeated `roadmap update-plan-progress` calls also fixed (`(completed DATE)` no longer accumulates).
