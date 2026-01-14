<principles>
Core principles for the Gets Shit Done planning system.

<solo_developer_claude>

You are planning for ONE person (the user) and ONE implementer (Claude).
- No teams, stakeholders, ceremonies, coordination overhead
- User is the visionary/product owner
- Claude is the builder
- Estimate effort in Claude execution time, not human dev time
</solo_developer_claude>

<plans_are_prompts>

PLAN.md is not a document that gets transformed into a prompt.
PLAN.md IS the prompt. It contains:
- Objective (what and why)
- Context (@file references)
- Tasks (with verification criteria)
- Success criteria (measurable)

When planning a phase, you are writing the prompt that will execute it.
</plans_are_prompts>

<initialization_leverage>

The most leveraged moment is project initialization.
- Deep questioning here = better everything downstream
- Garbage in = garbage out
- Spend the tokens on context gathering
- Don't rush to "the work"
</initialization_leverage>

<scope_control>

Plans must complete within reasonable context usage.

**Quality degradation curve:**
- 0-30% context: Peak quality
- 30-50% context: Good quality
- 50-70% context: Degrading quality
- 70%+ context: Poor quality

**Solution:** Aggressive atomicity - split into small, focused plans.
- 2-3 tasks per plan maximum
- Each plan independently executable
- Better to have many small plans than few large ones
</scope_control>

<claude_automates>

If Claude CAN do it via CLI/API/tool, Claude MUST do it.

Checkpoints are for:
- **Verification** - Human confirms Claude's work (visual, UX)
- **Decision** - Human makes implementation choice

Not for:
- Deploying (use CLI)
- Creating resources (use CLI/API)
- Running builds/tests (use Bash)
- Writing files (use Write tool)
</claude_automates>

<deviation_rules>

Plans are guides, not straitjackets. During execution:

1. **Auto-fix bugs** - Fix immediately, document
2. **Auto-add critical** - Security/correctness gaps, add immediately
3. **Auto-fix blockers** - Can't proceed, fix immediately
4. **Ask about architectural** - Major changes, stop and ask
5. **Log enhancements** - Nice-to-haves, log to Issues, continue
</deviation_rules>

<test_driven_when_beneficial>

Use TDD when the work WOULD benefit from it. Not dogma—pragmatism.

**TDD candidates (create dedicated TDD plan):**
- Business logic with defined inputs/outputs
- API endpoints and handlers
- Data transformations and parsing
- Validation rules
- State machines and workflows
- Anything where you can describe expected behavior before implementing

**Skip TDD (use standard plan):**
- UI layout and styling
- Exploratory prototyping
- One-off scripts and migrations
- Configuration changes
- Glue code with no logic

**Decision heuristic:**
Can you write `expect(fn(input)).toBe(output)` before writing `fn`?
→ Yes: Create a TDD plan (one feature per plan)
→ No: Standard plan, add tests after if needed

**Why TDD gets its own plan:**
TDD requires 2-3 execution cycles (RED → GREEN → REFACTOR), each with file reads, test runs, and potential debugging. This consumes 40-50% of context for a single feature. Dedicated TDD plans ensure full quality throughout the cycle.

**TDD plan structure:**
1. Write failing test (RED) → commit
2. Implement to pass (GREEN) → commit
3. Refactor if needed → commit

This is about design quality, not test coverage metrics.

See `~/.config/opencode/gsd/references/tdd.md` for TDD plan structure.
</test_driven_when_beneficial>

<ship_fast>

No enterprise process. No approval gates.

Plan → Execute → Ship → Learn → Repeat

Milestones mark shipped versions (v1.0 → v1.1 → v2.0).
</ship_fast>

<atomic_commits>

**Git commits = context engineering for Claude.**

Each task gets its own commit immediately after completion:
- Format: `{type}({phase}-{plan}): {task-description}`
- Types: feat, fix, test, refactor, perf, chore, docs
- One final metadata commit per plan: `docs({phase}-{plan}): complete [plan-name]`

**Why per-task commits:**
- Git history becomes primary context source for future Claude sessions
- `git bisect` finds exact failing task, not just failing plan
- Each task independently revertable
- Better failure recovery (task 1 committed ✅, retry task 2)
- Observability optimized for AI workflow, not human browsing

**Plans produce 3-4 commits total:**
- 2-3 task commits (working code)
- 1 metadata commit (SUMMARY + STATE + ROADMAP)

See `~/.config/opencode/gsd/references/git-integration.md` for complete strategy.
</atomic_commits>

<anti_enterprise>

NEVER include:
- Team structures, RACI matrices
- Stakeholder management
- Sprint ceremonies
- Human dev time estimates (hours, days, weeks—Claude works differently)
- Change management processes
- Documentation for documentation's sake

If it sounds like corporate PM theater, delete it.
</anti_enterprise>
</principles>
