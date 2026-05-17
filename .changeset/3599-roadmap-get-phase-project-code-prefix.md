---
type: Fixed
issue: 3599
---
**`roadmap get-phase PROJ-42` now matches `### Phase PROJ-42:` instead of returning `found: false`** — `cmdRoadmapGetPhase` now does a two-pass search when the caller passes a project-code-prefixed ID. The exact-escaped form (`### Phase PROJ-42:`) is tried first, and only falls back to the #3537 padding-tolerant numeric form (`### Phase 42:`) when the exact heading is not present. New helper `phaseMarkdownRegexSourceExact()` is added alongside the existing `phaseMarkdownRegexSource()` so callers that need the prefix-preserving path can opt in.
