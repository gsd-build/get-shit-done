---
type: Fixed
pr: 3096
---
**`ai-integration-phase` Steps 7+8 now enforce sequential execution and Edit-only tool discipline** — when `gsd-ai-researcher` and `gsd-domain-researcher` were dispatched in parallel (an optimization an orchestrator could reasonably make since the sections appeared disjoint), `gsd-domain-researcher`'s `Write` call at finalization silently replaced the entire AI-SPEC.md with its pre-researcher copy, losing Sections 3/4. Confirmed at 40% incidence rate (2 of 5 agents on a real run). Fix adds an explicit sequential ordering note to Steps 7+8 ("MUST run sequentially — wait for Step 7 to complete before spawning Step 8") and injects Edit-only tool discipline into both agent prompts ("Use the Edit tool exclusively — NEVER use Write on this file"). Closes #3096.
