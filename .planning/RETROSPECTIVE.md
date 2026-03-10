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

## Cross-Milestone Trends

| Metric | v1.23 |
|--------|-------|
| Phases | 4 |
| Plans | 6 |
| Tests added | 104 |
| Bug fixes post-verification | 3 |
| Requirements satisfied | 22/22 |
| Requirements deferred | 1 (QUAL-02) |
