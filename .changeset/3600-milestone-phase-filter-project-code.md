---
type: Fixed
issue: 3600
---
**`init.new-milestone` now counts project-code-prefixed phase directories** — `getMilestonePhaseFilter` previously skipped `.planning/phases/CK-01-name` against a numeric ROADMAP heading like `### Phase 1:`: the numeric matcher required the directory name to start with a digit and the custom-ID matcher compared the full prefixed name against the bare milestone token. Added a strip-and-retry path that strips the same `^[A-Z]{1,6}-(?=\d)` prefix `normalizePhaseName` already recognises and retries the numeric match. The fix lands in both the CJS runtime (`get-shit-done/bin/lib/core.cjs:isDirInMilestone`) and the SDK twin (`sdk/src/query/state.ts:isDirInMilestone`), and is shared by every caller of `getMilestonePhaseFilter` — including `init.new-milestone`, `phase complete`, `verify-work`, and `validate-health`.
