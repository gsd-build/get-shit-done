<decimal_phase_numbering>
Decimal phases enable urgent work insertion without renumbering:

- Integer phases (1, 2, 3) = planned milestone work
- Decimal phases (2.1, 2.2) = urgent insertions between integers

**Rules:**
- Decimals between consecutive integers (2.1 between 2 and 3)
- Filesystem sorting works automatically (2 < 2.1 < 2.2 < 3)
- Directory format: `02.1-description/`, Plan format: `02.1-01-PLAN.md`

**Validation:** Integer X must exist and be complete, X+1 must exist, decimal X.Y must not exist, Y >= 1
</decimal_phase_numbering>

<required_reading>
**Read these files NOW:**

1. ~/.claude/get-shit-done/templates/phase-prompt.md
2. ~/.claude/get-shit-done/references/plan-format.md
3. ~/.claude/get-shit-done/references/scope-estimation.md
4. ~/.claude/get-shit-done/references/checkpoints.md
5. .planning/ROADMAP.md
6. .planning/PROJECT.md

**Load domain expertise from ROADMAP:**
- Parse ROADMAP.md's `## Domain Expertise` section for paths
- Read each domain SKILL.md (these serve as indexes)
- Determine phase type and load ONLY references relevant to THIS phase type from each SKILL.md's `<references_index>`
</required_reading>

<purpose>
Create an executable phase prompt (PLAN.md). PLAN.md IS the prompt that Claude executes - not a document that gets transformed.
</purpose>

<process>

<step name="load_project_state" priority="first">
Read `.planning/STATE.md` and parse:
- Current position (which phase we're planning)
- Accumulated decisions (constraints on this phase)
- Deferred issues (candidates for inclusion)
- Blockers/concerns (things this phase may address)
- Brief alignment status

If STATE.md missing but .planning/ exists, offer to reconstruct or continue without.
</step>

<step name="load_codebase_context">
Check for codebase map:

```bash
ls .planning/codebase/*.md 2>/dev/null
```

**If .planning/codebase/ exists:** Load relevant documents based on phase type:

| Phase Keywords | Load These |
|----------------|------------|
| UI, frontend, components | CONVENTIONS.md, STRUCTURE.md |
| API, backend, endpoints | ARCHITECTURE.md, CONVENTIONS.md |
| database, schema, models | ARCHITECTURE.md, STACK.md |
| testing, tests | TESTING.md, CONVENTIONS.md |
| integration, external API | INTEGRATIONS.md, STACK.md |
| refactor, cleanup | CONCERNS.md, ARCHITECTURE.md |
| setup, config | STACK.md, STRUCTURE.md |
| (default) | STACK.md, ARCHITECTURE.md |

Track extracted constraints for PLAN.md context section.
</step>

<step name="identify_phase">
Check roadmap and existing phases:

```bash
cat .planning/ROADMAP.md
ls .planning/phases/
```

If multiple phases available, ask which one to plan. If obvious (first incomplete phase), proceed.

**Phase number parsing:** Regex `^(\d+)(?:\.(\d+))?$` - Group 1: integer, Group 2: decimal (optional)

**If decimal phase:** Validate integer X exists and is complete, X+1 exists in roadmap, decimal X.Y doesn't exist, Y >= 1.

Read any existing PLAN.md or DISCOVERY.md in the phase directory.
</step>

<step name="mandatory_discovery">
**Discovery is MANDATORY unless you can prove current context exists.**

<discovery_decision>
**Level 0 - Skip** (pure internal work, existing patterns only)
- ALL work follows established codebase patterns (grep confirms)
- No new external dependencies
- Pure internal refactoring or feature extension
- Examples: Add delete button, add field to model, create CRUD endpoint

**Level 1 - Quick Verification** (2-5 min)
- Single known library, confirming syntax/version
- Low-risk decision (easily changed later)
- Action: Context7 resolve-library-id + query-docs, no DISCOVERY.md needed

**Level 2 - Standard Research** (15-30 min)
- Choosing between 2-3 options
- New external integration (API, service)
- Medium-risk decision
- Action: Route to workflows/discovery-phase.md depth=standard, produces DISCOVERY.md

**Level 3 - Deep Dive** (1+ hour)
- Architectural decision with long-term impact
- Novel problem without clear patterns
- High-risk, hard to change later
- Action: Route to workflows/discovery-phase.md depth=deep, full DISCOVERY.md

**Depth indicators:**
- Level 2+: New library not in package.json, external API, "choose/select/evaluate" in description, roadmap marked Research: Yes
- Level 3: "architecture/design/system", multiple external services, data modeling, auth design, real-time/distributed
</discovery_decision>

If roadmap flagged `Research: Likely`, Level 0 (skip) is not available.

For niche domains (3D, games, audio, shaders, ML), suggest `/gsd:research-phase` before plan-phase.
</step>

<step name="read_project_history">
**From STATE.md:** Decisions → constrain approach. Deferred issues → candidates. Blockers → may need to address.

**From prior summaries:**

```bash
ls .planning/phases/*/*-SUMMARY.md 2>/dev/null | sort
```

Scan for decisions constraining this phase, issues flagged for "later", warnings in "Next Phase Readiness", patterns to maintain.

**From ISSUES.md:**

```bash
cat .planning/ISSUES.md 2>/dev/null
```

Assess each open issue - relevant to this phase? Waiting long enough? Natural to address now? Blocking something?

**Answer before proceeding:**
- Q1: What decisions from previous phases constrain this phase?
- Q2: Are there deferred issues that should become tasks?
- Q3: Are there concerns from "Next Phase Readiness" that apply?
- Q4: Given all context, does the roadmap's description still make sense?

Track for PLAN.md context section: relevant summaries, applicable decisions, issues being addressed, concerns being verified.
</step>

<step name="gather_phase_context">
Understand:
- Phase goal (from roadmap)
- What exists already (scan codebase if mid-project)
- Dependencies met (previous phases complete?)
- Any {phase}-RESEARCH.md (from /gsd:research-phase)
- Any DISCOVERY.md (from mandatory discovery)
- Any {phase}-CONTEXT.md (from /gsd:discuss-phase)

```bash
# If mid-project, understand current state
ls -la src/ 2>/dev/null
cat package.json 2>/dev/null | head -20

# Check for ecosystem research (from /gsd:research-phase)
cat .planning/phases/XX-name/${PHASE}-RESEARCH.md 2>/dev/null

# Check for phase context (from /gsd:discuss-phase)
cat .planning/phases/XX-name/${PHASE}-CONTEXT.md 2>/dev/null
```

**If RESEARCH.md exists:** Use standard_stack (these libraries), architecture_patterns (follow in task structure), dont_hand_roll (NEVER custom solutions for listed problems), common_pitfalls (inform verification), code_examples (reference in actions).

**If CONTEXT.md exists:** Honor vision, prioritize essential, respect boundaries, incorporate specifics.

**If neither exist:** Suggest /gsd:research-phase for niche domains, /gsd:discuss-phase for simpler domains, or proceed with roadmap only.
</step>

<step name="break_into_tasks">
Decompose phase into tasks. Each task needs:
- **Type**: auto, checkpoint:human-verify, checkpoint:decision (human-action rarely needed)
- **Task name**: Clear, action-oriented
- **Files**: Which files created/modified (for auto tasks)
- **Action**: Specific implementation (including what to avoid and WHY)
- **Verify**: How to prove it worked
- **Done**: Acceptance criteria

**TDD fit:** Can you write `expect(fn(input)).toBe(output)` before writing `fn`? Yes (business logic, APIs, validation) → test-first. No (UI layout, config, glue code) → standard implementation.

**Checkpoints:** Visual/functional verification → checkpoint:human-verify. Implementation choices → checkpoint:decision. Manual action (email, 2FA) → checkpoint:human-action (rare).

**Critical:** If external resource has CLI/API (Vercel, Stripe, etc.), use type="auto" to automate. Only checkpoint for verification AFTER automation.

See ~/.claude/get-shit-done/references/checkpoints.md for checkpoint structure.
</step>

<step name="estimate_scope">
After tasks, assess against quality degradation curve.

**ALWAYS split if:** >3 tasks, multiple subsystems, >5 files in any task, complex domains (auth, payments).

**If scope appropriate (2-3 tasks, single subsystem, <5 files/task):** Proceed to confirm_breakdown.

**If large (>3 tasks):** Split by subsystem, dependency, complexity, or autonomous vs interactive.

**Each plan must be:** 2-3 tasks max, ~50% context target, independently committable.

**Autonomous optimization:** No checkpoints → subagent (fresh context). Has checkpoints → main context. Group autonomous work together.

See ~/.claude/get-shit-done/references/scope-estimation.md for complete guidance.
</step>

<step name="confirm_breakdown">
<if mode="yolo">
Auto-approve and proceed to write_phase_prompt.
</if>

<if mode="interactive">
Present breakdown inline:

```
Phase [X] breakdown:

### Tasks ({phase}-01-PLAN.md)
1. [Task] - [brief] [type]
2. [Task] - [brief] [type]

Autonomous: [yes/no]

Does this look right? (yes / adjust / start over)
```

For multiple plans, show each plan with its tasks.

Wait for confirmation. If "adjust": revise. If "start over": return to gather_phase_context.
</if>
</step>

<step name="write_phase_prompt">
Use template from `~/.claude/get-shit-done/templates/phase-prompt.md`.

**Single plan:** Write to `.planning/phases/XX-name/{phase}-01-PLAN.md`

**Multiple plans:** Write separate files ({phase}-01-PLAN.md, {phase}-02-PLAN.md, etc.)

Each plan follows template structure with:
- Frontmatter (phase, plan, type, domain)
- Objective (plan-specific goal, purpose, output)
- Execution context (execute-phase.md, summary template, checkpoints.md if needed)
- Context (@references to PROJECT, ROADMAP, STATE, codebase docs, RESEARCH/DISCOVERY/CONTEXT if exist, prior summaries, source files, prior decisions, deferred issues, concerns)
- Tasks (XML format with types)
- Verification, Success criteria, Output specification

For multi-plan phases: each plan has focused scope, references previous plan summaries, last plan's success criteria includes "Phase X complete".
</step>

<step name="offer_next">
<yolo_spawn>
**If yolo mode: Execute spawn directly:**

```bash
PROJECT="$(basename "$(pwd)")-{phase}-01-$(date +%s)"
PLAN_PATH=".planning/phases/XX-name/{phase}-01-PLAN.md"
tmux new-window -n "$PROJECT" -c "$(pwd)" "claude --dangerously-skip-permissions --chrome '/gsd:execute-plan $PLAN_PATH'"
```

Then report:
```
Phase plan created: .planning/phases/XX-name/{phase}-01-PLAN.md
[X] tasks defined.

✓ Spawned: $PROJECT → /gsd:execute-plan
Switch: Ctrl+B n
```
</yolo_spawn>

<interactive_fallback>
**If NOT yolo mode:**

```
Phase plan created: .planning/phases/XX-name/{phase}-01-PLAN.md
[X] tasks defined.

---

## Next Up

**{phase}-01: [Plan Name]** - [objective summary]

`/gsd:execute-plan .planning/phases/XX-name/{phase}-01-PLAN.md`

---
```
</interactive_fallback>

</step>

</process>

<task_quality>
**Good tasks:** Specific files, actions, verification
- "Add User model to Prisma schema with email, passwordHash, createdAt"
- "Create POST /api/auth/login endpoint with bcrypt validation"

**Bad tasks:** Vague, not actionable
- "Set up authentication" / "Make it secure" / "Handle edge cases"

If you can't specify Files + Action + Verify + Done, the task is too vague.
</task_quality>

<anti_patterns>
- No story points or hour estimates
- No team assignments
- No acceptance criteria committees
- No sub-sub-sub tasks
Tasks are instructions for Claude, not Jira tickets.
</anti_patterns>

<success_criteria>
Phase planning complete when:
- [ ] STATE.md read, project history absorbed
- [ ] Mandatory discovery completed (Level 0-3)
- [ ] Prior decisions, issues, concerns synthesized
- [ ] PLAN file(s) exist with XML structure
- [ ] Each plan: Objective, context, tasks, verification, success criteria, output
- [ ] @context references included (STATE, RESEARCH/DISCOVERY if exist, relevant summaries)
- [ ] Each plan: 2-3 tasks (~50% context)
- [ ] Each task: Type, Files (if auto), Action, Verify, Done
- [ ] Checkpoints properly structured
- [ ] If RESEARCH.md exists: "don't hand-roll" items NOT being custom-built
- [ ] User knows next steps
</success_criteria>
