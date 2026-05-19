---
type: Fixed
pr: 3655
---
**`/gsd:health` no longer fires W002 for archived phase numbers in STATE.md body (#3652)** — after `/gsd:complete-milestone`, phase directories move into `milestones/vX.Y-phases/` and their `#### Phase N:` headings in ROADMAP.md are collapsed inside `<details>` blocks. Neither the on-disk phases scan nor the ROADMAP heading scan picked them up, so W002 fired for every archived phase number referenced in STATE.md's historical narrative body (`## Recent`, `## Decisions`, `## Deferred Items`). Projects ran permanently `degraded` with W002 noise growing proportionally to lifetime phase count. The validity set now also unions phase directories from any `milestones/vX.Y-phases/` archive, mirroring the W006 archive-lookup. Uses the shared `PHASE_TOKEN_FROM_DIR_RE` / `MILESTONE_ARCHIVE_DIR_RE` constants so project-code-prefixed dirs (e.g. `CK-64-foo`) are recognised.
