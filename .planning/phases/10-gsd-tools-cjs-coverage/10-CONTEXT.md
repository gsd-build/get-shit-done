# Phase 10: gsd-tools.cjs Coverage - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Test the gsd-tools.cjs CLI dispatcher to reach 85%+ line coverage. Cover all dispatch branches, unknown command handling, and error paths (bad args, missing files). The dispatcher already exists — this phase writes tests, not features.

</domain>

<decisions>
## Implementation Decisions

### Test invocation style
- CLI spawn (execSync/spawn the actual binary) — tests real behavior including exit codes, stdout/stderr
- Each test creates temp directories with controlled `.planning/` structure — isolated, repeatable, no side effects
- One test file per command group (dispatch.test.js, state-commands.test.js, phase-commands.test.js, etc.)

### Error output expectations
- Unknown commands: print "Unknown command: X" to stderr with usage hint (suggest similar commands if close match), exit code 1
- Assertions use pattern matching (stderr contains key phrases, exit code non-zero) — not exact text matching
- Bugs found during testing: fix the bug, test expected/correct behavior — don't document broken state

### Coverage priorities
- Dispatch routing logic and all error paths first (satisfies DISP-01, DISP-02)
- Then fill remaining command branches to hit 85%+ line coverage
- 85% target measured on gsd-tools.cjs file only — helper modules have their own phases
- Follow existing project test framework and naming conventions

### Claude's Discretion
- Git operation handling in tests (temp git repos vs skipping git-dependent paths)
- Missing argument error format (whether to include usage pattern per command)
- Error format when --raw flag is used (JSON vs plain text stderr)
- Exact test file organization within the one-file-per-group structure

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

*Phase: 10-gsd-tools-cjs-coverage*
*Context gathered: 2026-02-25*
