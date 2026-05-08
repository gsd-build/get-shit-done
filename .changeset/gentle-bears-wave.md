---
type: Fixed
pr: 3252
---
**`state.update <field>` no longer rebuilds the progress.* block from disk on body-only updates** — manually-curated cross-milestone counters are preserved. Also: progress.percent now reflects the lower of plan-fraction and phase-fraction so milestones with un-planned future phases don't show false 100%.
