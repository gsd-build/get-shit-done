---
type: Added
pr: 3515
---
**Context-window meter position is now configurable via `statusline.context_position`** — set `"front"` to render the meter immediately after the model name (useful in narrow terminals where the right edge is clipped); the default `"end"` preserves the existing byte-identical output. Invalid values at `config-set` time are hard-rejected by the enum validator; at hook runtime an invalid/stale config silently falls back to `"end"` so the statusline is never broken. Closes #2937.
