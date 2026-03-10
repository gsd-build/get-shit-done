# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.23 — Copilot CLI Support

**Shipped:** 2026-03-03
**Phases:** 4 | **Plans:** 6

### What Was Built
- Copilot as 5th runtime in GSD installer with full CLI integration (flags, prompt, directory resolution)
- Content conversion engine: 31 skills, 11 agents, 13 tool mappings, 4 path patterns
- Instructions lifecycle: marker-based merge/strip, uninstall, manifest, patches
- 104 Copilot-specific tests (15 E2E with SHA256 integrity), 566 total passing

### What Worked
- Strict dependency chain (plumbing → conversion → lifecycle → validation) prevented rework
- Following Codex patterns for skip-hooks and manifest hashing accelerated development
- Dedicated conversion functions (not reusing Codex converter) gave cleaner architecture
- E2E tests with `execFileSync` + `GSD_TEST_MODE` stripping caught real integration issues

### What Was Inefficient
- ROADMAP.md progress table was never updated during phases — stale documentation accumulated
- CONV-09 (router skill) was in requirements but discarded during Phase 2 — earlier scoping would have avoided
- Path mapping bug (`~/.copilot/` vs `.github/` for local) was discovered post-Phase-4 — could have been caught earlier with path-specific E2E assertions
- Double path replacement in `copyWithPathReplacement` (generic + Copilot converter) was subtle — needed investigation

### Patterns Established
- `isGlobal` parameter pattern for converters that need different local/global behavior
- Paired HTML comment markers for Copilot instructions (vs Codex single-marker-to-EOF)
- `yamlQuote()` via `JSON.stringify` for YAML values that may contain quotes
- Skip generic path replacement for runtimes with custom converters (`!isCopilot` guard)

### Key Lessons
1. Path mapping is the #1 source of bugs when adding runtimes with non-standard directory structures
2. Generic path replacement before runtime-specific conversion causes subtle double-replacement issues
3. E2E tests should assert specific path patterns (`.github/` vs `~/.copilot/`) not just file existence
4. YAML quoting needs explicit handling — template literals with backticks/quotes are fragile

---

## Milestone: v1.24 — Autonomous Skill

**Shipped:** 2026-03-10
**Phases:** 4 | **Plans:** 5

### What Was Built
- `gsd-autonomous` skill: 743-line workflow for fully autonomous milestone execution
- Smart discuss: proposes grey area answers in tables instead of open-ended questions
- Phase execution chain: discuss→plan→execute with VERIFICATION.md-based routing
- Lifecycle automation: audit→complete→cleanup runs after all phases finish
- Roadmap regex fix for colon-outside-bold format

### What Worked
- Skill() flat calls avoided deep nesting freezes (Issue #686) — critical architectural decision
- Building incrementally (skeleton → discuss → chain → lifecycle) kept each phase focused
- Reusing existing skills via Skill() instead of reimplementing gave reliable behavior
- Inline smart discuss produces identical CONTEXT.md output to regular discuss-phase
- `--no-transition` flag on execute-phase cleanly separated autonomous flow from existing chaining

### What Was Inefficient
- Progress table in ROADMAP.md went stale again (same issue as v1.23) — needs automation
- Phase 5 discovered a regex bug that should have been caught by existing tests
- STATE.md progress percent was stuck at 50% — tool calculates incorrectly for continuation milestones

### Patterns Established
- Skill() flat calls pattern for multi-skill orchestration workflows
- VERIFICATION.md status parsing for autonomous routing (passed/human_needed/gaps_found)
- Infrastructure phase detection heuristic (3-criteria: no code, setup/config keywords, dependency-only)
- Gap closure with 1-retry limit to prevent infinite loops
- `--no-transition` flag for skills that manage their own flow

### Key Lessons
1. Deep nesting of Task() calls causes runtime freezes — always use flat Skill() calls for orchestration
2. Regex patterns must be tested for ALL formatting variants found in actual data files
3. Progress tracking in STATE.md needs fresh calculation per milestone, not continuation from previous
4. Autonomous skills should produce identical artifacts as manual flows — easier to validate and debug

---

## Cross-Milestone Trends

| Metric | v1.23 | v1.24 |
|--------|-------|-------|
| Phases | 4 | 4 |
| Plans | 6 | 5 |
| Tests added | 104 | 2 |
| Bug fixes post-verification | 3 | 1 |
| Requirements satisfied | 22/22 | 18/18 |
| Requirements deferred | 1 (QUAL-02) | 0 |
