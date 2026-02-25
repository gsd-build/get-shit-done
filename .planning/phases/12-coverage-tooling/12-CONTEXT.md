# Phase 12: Coverage Tooling - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Integrate c8 coverage reporting into the test suite and enforce a 70% line coverage threshold via CI. This phase adds tooling and enforcement — it does not write new tests or increase coverage of any specific module.

</domain>

<decisions>
## Implementation Decisions

### Report output
- Per-file table format in terminal (standard c8/Istanbul output)
- Terminal only — no HTML report generation
- Default c8 highlighting for low-coverage files (no custom formatting)
- Add coverage/ to .gitignore (coverage artifacts are generated, not committed)

### Threshold configuration
- Single global 70% line coverage threshold for all modules
- Lines only — no branch or function coverage enforcement
- Threshold defined inline in package.json scripts (c8 --lines 70 ...)
- No grace period — enforce immediately (phases 1-11 brought coverage up)

### CI behavior
- Add coverage to existing test job (replace npm test with npm run test:coverage in CI)
- Coverage runs on PRs only, not on every push
- No PR comment or coverage summary bot — just pass/fail
- Default c8 error output on threshold failure (already prints failing files + exits non-zero)

### Module targeting
- Measure source modules only (.cjs/.js in source directory)
- Exclude entry points / CLI files (bin/gsd-tools.cjs)
- Exclude coverage/, node_modules/, and generated/vendored files
- Keep npm test and npm run test:coverage as separate scripts (test = fast, no coverage)

### Claude's Discretion
- Exact c8 CLI flags and include/exclude glob patterns
- Whether to use --all flag (report uncovered files that aren't imported by tests)
- .gitignore formatting and placement of coverage/ entry

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-coverage-tooling*
*Context gathered: 2026-02-25*
