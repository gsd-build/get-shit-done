<quality_enforcement>

# Quality Enforcement Reference

Master reference for GSD quality features. All features are opt-in via `.planning/config.json` quality section.

## TDD Enforcement Tiers

### off (default)
No enforcement. Write tests when convenient. Standard GSD execution.

### basic
Prompt-based RED-GREEN-REFACTOR cycle.

- Triggered by `tdd="true"` task attribute OR `quality.tdd_mode: "basic"`
- Executor follows strict RED → GREEN → REFACTOR sequence
- 2-3 atomic commits per feature (test, implementation, optional refactor)
- Advisory — not hook-enforced

### full
Hook-enforced TDD with coverage gates.

Everything from basic tier, plus:

**Coverage gate:** After GREEN phase, coverage must meet `quality.coverage_threshold` for task files.
```bash
npm run test:coverage
```

**Hook enforcement:** The tdd-guard hook blocks Write/Edit on non-test files when tests are failing.
- Write test first (hook allows test file writes)
- Run tests (they fail — expected in RED)
- Write implementation (hook allows because tests exist)
- Run tests again (they pass — GREEN)

Install hooks: `/gsd:setup-tdd-hooks`

## Traceability Chain (when quality.specs is true)

When specs are enabled, IDs flow through the system:

```
SPEC.md (requirement IDs: TL-1, TL-2)
  → GHERKIN.md (scenario IDs: TL-1.1, TL-1.2)
    → PLAN.md (task spec_ref="TL-1")
      → Test files (describe/it blocks reference TL-1.1)
        → VERIFICATION.md (checks TL-1 through TL-N covered)
```

**In task XML:**
```xml
<task type="auto" tdd="true" spec_ref="TL-1">
  <name>Implement task creation</name>
  <files>src/features/tasks/create.ts, src/features/tasks/create.test.ts</files>
  <action>Implement TL-1. Test IDs: TL-1.1 through TL-1.5.</action>
  <verify>TL-1.1 through TL-1.5 pass. Coverage >= threshold for create.ts.</verify>
</task>
```

**In test files:**
```typescript
describe('TL: Task Lifecycle', () => {
  it('TL-1.1: creates task with title and description', () => { ... });
  it('TL-1.2: rejects empty title', () => { ... });
});
```

## Full-Stack Test Strategy

When `quality.tdd_mode` is `basic` or `full`, prefer tests that exercise the full stack:
- Integration tests over unit tests where possible
- Test public APIs and user-observable behavior
- Avoid testing implementation details

## Coverage Threshold

Default: 80%. Configurable per project.

Only enforced in `tdd_mode: "full"`. Applied to files listed in task's `<files>` element, not the entire codebase.

</quality_enforcement>
