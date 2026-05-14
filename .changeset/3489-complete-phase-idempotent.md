---
type: Fixed
pr: 3489
---
**`state complete-phase` is now idempotent — re-invocation no longer rolls STATE.md back.** Previously, running `gsd-sdk query state.complete-phase --phase <N>` (or `gsd state complete-phase --phase <N>`) a second time on a phase that was already marked complete silently rewound STATE.md to that phase's moment-of-completion, clobbering `Status`, `Last Activity`, `Last Activity Description`, and the `## Current Position` body. Any downstream consumer trusting STATE.md (`/gsd-progress`, planner, the next phase's discuss-phase context loader) was routed back to the rolled-back phase. The handler now reads STATE.md before writing: if the canonical `Current Phase` field already names a phase distinct from the one being completed, the project has clearly advanced past it and the handler returns a no-op (`{ updated: [], phase: "<N>", idempotent: true, note: "phase already superseded; no-op" }`) without touching STATE.md. (#3489)
