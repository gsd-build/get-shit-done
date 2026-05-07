---
type: Fixed
pr: 3212
---
**Executor stall + STATE drift detection** — adds atomic close-out invariant doc, opt-in plan-consistency-check (STATE.md vs disk vs git log) used by resume-project to detect partial-execution drift, and dispatch.commit-since surveillance probe complementing subagent_timeout. All changes additive.
