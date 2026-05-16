---
type: Fixed
issue: 3601
---
**`phase remove N` no longer collapses adjacent peer-depth decimal phases** — `updateRoadmapAfterPhaseRemoval` in `get-shit-done/bin/lib/phase.cjs` now uses a depth-aware end-of-section lookahead that captures the hash count of the header being removed and stops only at a subsequent header of the SAME depth. Previously the lookahead required the next header's digits to be followed by `\s*:`, which failed on `### Phase 2.1:` (the `.1` blocks the match) and silently consumed the decimal sibling along with the integer phase. The fix preserves `### Phase 2.1:` (peer-depth decimal) while still removing `#### Phase 27.1:` (child-depth decimal under `### Phase 27:`).
