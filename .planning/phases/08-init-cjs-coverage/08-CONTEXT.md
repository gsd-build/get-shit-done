# Phase 8: init.cjs Coverage - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Bring init.cjs from 42% to 75%+ line coverage by testing all 12 exported init command functions. Requirements INIT-01 through INIT-06 define the 6 test groups. Existing init.test.cjs has 19 tests covering file paths and phase_req_ids extraction — new tests extend coverage to function-specific logic, branching, and edge cases.

</domain>

<decisions>
## Implementation Decisions

### Filesystem testing approach
- Use real temp directories via `createTempProject()` for all filesystem operations — consistent with established test suite pattern
- Use realistic fixtures for STATE.md and ROADMAP.md content (full document structure, not minimal stubs) to catch parsing issues with surrounding content

### Claude's Discretion
- **Test plan grouping**: How to split 6 requirements into plan files (2-3 plans). Claude assesses function complexity and test dependencies to determine optimal grouping
- **File layout**: Whether new tests extend init.test.cjs or create separate files — Claude picks based on existing codebase conventions
- **Plan execution order**: Independent vs ordered plans — Claude picks based on what makes tests most maintainable
- **Function priority**: Claude assesses which functions have the most untested branches and prioritizes accordingly
- **execSync mocking**: For cmdInitNewProject's `find` shell-out, Claude decides whether to use real temp dirs with actual files or mock execSync based on reliability vs speed tradeoff
- **Coverage targets per function**: Claude determines whether to aim for 75% across the board or go deeper (85%+) on critical functions like cmdInitProgress, cmdInitPhaseOp, cmdInitExecutePhase
- **cmdInitPhaseOp fallback depth**: Claude determines how thoroughly to test the synthetic phaseInfo construction when no directory exists
- **Branching strategy coverage**: Claude decides which of the 3 branch_name computation paths (phase, milestone, null) to test based on regression risk
- **Phase status detection**: Claude determines which of the 4 statuses (complete, in_progress, researched, pending) and transitions to cover in cmdInitProgress tests
- **Error path coverage**: Claude determines which empty-catch fallback paths are worth testing based on risk assessment
- **Area filtering in cmdInitTodos**: Claude assesses whether filtering path is commonly used enough to warrant dedicated tests
- **cmdInitQuick numbering edge cases**: Claude decides depth based on how brittle the regex parsing is
- **Archive scanning in cmdInitMilestoneOp**: Claude picks based on whether it adds meaningful coverage percentage

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User trusts Claude's judgment on almost all technical decisions for this test coverage phase. The only firm requirement is maintaining consistency with the existing test suite's temp directory pattern and using realistic (not minimal) fixture content.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-init-cjs-coverage*
*Context gathered: 2026-02-25*
