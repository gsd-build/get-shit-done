# TDD Plan Template

> **Note:** TDD methodology is in `references/tdd.md`.
> This template defines the TDD PLAN.md output format for Python projects.
> For standard (non-TDD) plans, use `templates/phase-prompt.md`.

Template for `.planning/phases/XX-name/{phase}-{plan}-PLAN.md` when `type: tdd`.

**When to use:** The planner sets `type: tdd` when Python files (`*.py`) appear in a plan's `files_modified`.

---

## File Template

~~~markdown
---
phase: XX-name
plan: NN
type: tdd
wave: N
depends_on: []
files_modified: []
autonomous: true

must_haves:
  truths: []
  artifacts: []
  key_links: []
---

<objective>
[What feature is being TDD'd and why]

Purpose: [Design benefit of TDD for this feature]
Output: [Working, tested feature with N tests]
</objective>

<execution_context>
@C:/Users/connessn/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/connessn/.claude/get-shit-done/templates/summary.md
@C:/Users/connessn/.claude/get-shit-done/references/tdd.md
@C:/Users/connessn/.claude/skills/pytest-writer/SKILL.md
@C:/Users/connessn/.claude/skills/test-driven-development/SKILL.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

[Relevant source files:]
@src/path/to/module.py
</context>

<infrastructure>
<!-- Include this section ONLY in the FIRST TDD plan for a project (no tests/ directory exists yet). -->
<!-- Remove this section from subsequent TDD plans. -->

Before starting the TDD cycle, set up test infrastructure per references/tdd.md <framework_setup> Python section:

1. Create tests/ directory with __init__.py and conftest.py
2. Create or update pyproject.toml with [tool.pytest.ini_options] and [tool.coverage] sections
3. Install: `uv pip install pytest pytest-cov`
4. Verify: `uv run pytest --co` (expect 0 tests collected)
</infrastructure>

<feature>
  <name>[Feature name]</name>
  <files>[source file path, test file path]</files>
  <behavior>
    [Expected behavior in testable terms]

    Cases:
    - input_1 -> expected_output_1
    - input_2 -> expected_output_2
    - edge_case -> expected_handling
  </behavior>
  <implementation>[How to implement once tests pass]</implementation>
</feature>

<tdd_cycle>

## RED: Write Failing Test

1. Create test file: `tests/test_{module}.py`
2. Write test(s) describing expected behavior from <behavior> section
3. Use pytest patterns from @pytest-writer skill:
   - `pytest.mark.parametrize` for multiple input/output cases
   - `pytest.raises` for expected exceptions
   - Descriptive test names: `test_{behavior}_{scenario}`
4. Run: `uv run pytest tests/test_{module}.py -v`
5. **GATE: Test MUST fail.** If test passes, STOP. Either:
   - The feature already exists (investigate, do not duplicate)
   - The test is wrong (not testing what you think)
   Do NOT proceed to GREEN until test fails for the RIGHT reason.
6. Commit: `test({phase}-{plan}): add failing test for [feature]`

## GREEN: Write Minimal Implementation

1. Read <implementation> guidance
2. Write the MINIMUM code to make the test pass
   - No cleverness, no optimization, no extras
   - If tempted to add "while I'm here" code, resist
3. Run: `uv run pytest tests/test_{module}.py -v`
4. **GATE: Test MUST pass.** If test fails:
   - Debug the implementation, NOT the test
   - The test defines correct behavior; the code must conform
   Do NOT proceed to REFACTOR until test passes.
5. Commit: `feat({phase}-{plan}): implement [feature]`

## REFACTOR: Clean Up (if needed)

1. Improve code quality: naming, structure, duplication removal
2. Run: `uv run pytest tests/ -v` (ALL tests, not just this feature)
3. **GATE: ALL tests MUST still pass.** If any test breaks:
   - Undo the refactor change
   - Try a smaller refactor step
   Do NOT commit broken refactors.
4. Commit (only if changes made): `refactor({phase}-{plan}): clean up [feature]`

</tdd_cycle>

<verification>
- [ ] `uv run pytest tests/ -v` -- all tests pass
- [ ] Test file exists: `tests/test_{module}.py`
- [ ] Implementation file exists: `src/{module}.py` (or appropriate path)
- [ ] RED commit present (test({phase}-{plan}): ...)
- [ ] GREEN commit present (feat({phase}-{plan}): ...)
- [ ] REFACTOR commit present if refactoring was done
</verification>

<success_criteria>
- Failing test written and committed (RED evidence in git log)
- Implementation passes test (GREEN evidence in git log)
- All tests pass after cleanup (REFACTOR evidence, if applicable)
- 2-3 atomic commits produced
</success_criteria>

<output>
After completion, create `.planning/phases/XX-name/{phase}-{plan}-SUMMARY.md` with:

In frontmatter:
- `tags: [tdd, python, pytest]`

In body:
- **RED:** What test was written, what failure message was observed
- **GREEN:** What implementation made it pass, how minimal was it
- **REFACTOR:** What cleanup was done (or "No refactoring needed")
- **Commits:** List of 2-3 commits with hashes
- **Test count:** Number of test functions/methods
</output>
~~~

---

## Template Usage Notes

**One feature per TDD plan.** If multiple features need testing, create multiple TDD plans. Do not batch features -- each TDD cycle needs full context.

**Context budget:** TDD plans target ~40% context (lower than standard plans' 50%). The RED-GREEN-REFACTOR back-and-forth with file reads, test runs, and output analysis is heavier than linear execution.

**Infrastructure section:** Include `<infrastructure>` ONLY in the first TDD plan for a project. Detection: if `tests/` directory does not exist, this is the first plan. Remove the section from all subsequent TDD plans.

**Skill references are mandatory.** The `<execution_context>` must include:
- `references/tdd.md` -- TDD methodology and framework setup
- `pytest-writer/SKILL.md` -- test patterns (fixtures, parametrize, mocking)
- `test-driven-development/SKILL.md` -- RED-GREEN-REFACTOR discipline

**GATE checks are non-negotiable.** Each phase transition has a GATE. The executor MUST verify the gate condition before proceeding. This is the enforcement mechanism for TDD discipline.

---

## Comparison with Standard Plans

| Aspect | Standard Plan (phase-prompt.md) | TDD Plan (tdd-plan.md) |
|--------|-------------------------------|----------------------|
| Type | `execute` | `tdd` |
| Structure | `<tasks>` with multiple `<task>` elements | `<feature>` with `<tdd_cycle>` |
| Commits | 1 per task (2-4 per plan) | 2-3 per feature (test, feat, refactor) |
| Context budget | ~50% | ~40% |
| Skills | None by default | pytest-writer, test-driven-development |
| Verification | Task-level checks | GATE checks at each phase transition |
