---
type: Fixed
pr: 3493
---
**`extractCurrentMilestone` preserves generic `## Phase Details` heading** — When a roadmap placed shared phase-detail bodies under a non-version-prefixed `## Phase Details` heading AFTER a `### 📋 vX.Y+ (Planned)` sibling, the entire Phase Details section fell outside the returned milestone slice. `gsd-sdk query phase.insert N` then reported "Phase N not found in ROADMAP.md" even though `### Phase N:` was plainly present. PR #2455 (closing #2422) handled the version-prefixed variant (`## v2.0 Phase Details`) via the same-version `continue` branch; this fix extends the same intent to the generic-label variant by appending the trailing `Phase Details` block (up to the next real milestone boundary or EOF) to the active-milestone slice. The intervening planned-milestone content is skipped so it does not leak in. (#3493)
