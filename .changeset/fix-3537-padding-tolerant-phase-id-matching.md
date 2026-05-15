---
type: Fixed
pr: 3539
---
**Padded phase IDs no longer silently no-op on un-padded ROADMAP prose** — `phaseMarkdownRegexSource()` (added in 1.42.1) was wired into only 1 of 8 affected sites; the rest used raw `escapeRegex(phaseNum)` and silently failed when skills resolved a padded `phase_number` like `02.7` and passed it to state verbs against un-padded prose like `### Phase 2.7:`. The helper is now wired across `cmdRoadmapGetPhase`, `cmdRoadmapAnalyze`, `cmdRoadmapAnnotateDependencies`, `cmdPhaseComplete`, `cmdPhaseNextDecimal`, `cmdPhaseInsert`, and `getRoadmapPhaseInternal`; promoted from `roadmap.cjs` to `core.cjs` so the three lib files share one definition without a circular import. Closes #3537.
