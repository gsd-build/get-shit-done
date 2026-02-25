<purpose>
Generate implementation context for a phase without human input. Spawns an odd number of agents (3/5/7/9) that analyze gray areas from different expert perspectives and converge on decisions via majority consensus.

Produces CONTEXT.md in the same format as discuss-phase — downstream agents (researcher, planner) consume it identically.
</purpose>

<philosophy>
discuss-phase captures the user's vision through Q&A. In autopilot, there's no user. The solution: synthetic debate from multiple expert perspectives.

This is better than skipping discuss — you get *debated* defaults from multiple expert perspectives, informed by existing project context. It won't capture the user's personal vision, but it will catch things a single agent would miss (edge cases, accessibility, performance tradeoffs).
</philosophy>

<process>

<step name="initialize" priority="first">
Phase number from argument (required).

```bash
INIT=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs init phase-op "${PHASE}")
```

Parse JSON for: `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `has_context`, `roadmap_exists`.

**If `phase_found` is false:** Return error — phase not found.

**If `has_context` is true:** Skip — CONTEXT.md already exists, return early with status.

Read agent count and model from config:
```bash
AGENT_COUNT=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs config-get autopilot.discuss_agents 2>/dev/null || echo "5")
DISCUSS_MODEL=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs config-get autopilot.discuss_model 2>/dev/null || echo "sonnet")
```
</step>

<step name="gather_inputs">
Collect the context each agent needs to make informed decisions.

**Read these files (paths only — agents read them with fresh context):**

1. Phase goal from ROADMAP.md:
```bash
ROADMAP_PHASE=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs roadmap get-phase "${PHASE}")
```

2. Identify available context files:
- `.planning/PROJECT.md` — project vision
- `.planning/REQUIREMENTS.md` — requirements
- `.planning/codebase/*.md` — codebase patterns (if exists)
- Previous phases' CONTEXT.md files — decisions already made (consistency)

```bash
PREV_CONTEXTS=$(ls .planning/phases/*-CONTEXT.md 2>/dev/null | sort)
```
</step>

<step name="analyze_gray_areas">
Same logic as discuss-phase's `analyze_phase` step. Read the phase goal and identify domain-specific gray areas.

**Determine the domain:**
- Something users SEE → layout, density, interactions, states
- Something users CALL → responses, errors, auth, versioning
- Something users RUN → output format, flags, modes, error handling
- Something users READ → structure, tone, depth, flow
- Something being ORGANIZED → criteria, grouping, naming, exceptions

**Generate 4-6 specific gray areas** for this phase. These become the debate topics.

Example for "User Authentication" phase:
```
1. Session handling — JWT lifetime, refresh strategy, concurrent sessions
2. Error responses — generic vs specific, rate limiting feedback
3. Multi-device policy — allow all, limit count, kick oldest
4. Recovery flow — email-only, SMS option, security questions
```
</step>

<step name="assign_perspectives">
Each agent gets a distinct expert role based on the configured count:

**3 agents:**
1. UX Designer — user experience, interaction patterns, accessibility
2. Engineer — technical feasibility, performance, maintainability
3. Product Owner — business value, scope, user impact

**5 agents (default):**
1-3 above, plus:
4. QA / Edge Cases — error states, boundary conditions, failure modes
5. Devil's Advocate — challenges assumptions, identifies risks

**7 agents:**
1-5 above, plus:
6. Domain Expert — industry conventions, standards compliance
7. Accessibility Specialist — WCAG, screen readers, keyboard navigation

**9 agents:**
1-7 above, plus:
8. Security — attack vectors, data protection, auth concerns
9. Performance — load times, caching, resource usage
</step>

<step name="spawn_debate">
Spawn all agents in parallel. Each agent independently analyzes gray areas from their perspective.

**Read execution engine config:**
```bash
ENGINE=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs config-get execution.engine 2>/dev/null || echo "subagents")
```

**Agent Teams mode (`ENGINE = "agent-teams"`):**

Create an Agent Team where teammates can message each other for real debate:
- Lead = this orchestrator (collects consensus)
- Teammates = one per perspective role
- Teammates debate gray areas, challenge each other, refine positions
- Lead collects final positions after debate concludes

**Subagents mode (`ENGINE = "subagents"`, default):**

Spawn each agent via Task(). Each independently returns recommendations.

```
For each agent (1 to AGENT_COUNT):
  Task(
    subagent_type="general-purpose",
    model="${DISCUSS_MODEL}",
    prompt="
      <objective>
      You are a ${ROLE_NAME} reviewing implementation decisions for Phase ${PHASE}: ${PHASE_NAME}.
      For each gray area, recommend a specific decision and justify it from your perspective.
      </objective>

      <your_perspective>
      ${ROLE_DESCRIPTION}
      Focus on: ${ROLE_FOCUS_AREAS}
      </your_perspective>

      <phase_context>
      Phase goal: ${PHASE_GOAL}
      Phase requirements: ${PHASE_REQUIREMENTS}
      </phase_context>

      <files_to_read>
      Read these files for context:
      - .planning/PROJECT.md (project vision)
      - .planning/REQUIREMENTS.md (requirements, if exists)
      - ${PREV_CONTEXT_FILES} (previous phase decisions, if any)
      - .planning/codebase/*.md (codebase patterns, if exists)
      </files_to_read>

      <gray_areas>
      For EACH of these gray areas, provide:
      1. Your recommended decision (be specific, not vague)
      2. Your justification from ${ROLE_NAME} perspective (2-3 sentences)
      3. Any caveats or conditions

      ${GRAY_AREAS_LIST}
      </gray_areas>

      <output_format>
      Return your recommendations as structured text:

      ## Gray Area: [name]
      **Decision:** [specific recommendation]
      **Justification:** [why, from your perspective]
      **Caveats:** [conditions or risks, if any]

      Repeat for each gray area.
      </output_format>
    ",
    description="${ROLE_NAME} review"
  )
```

Spawn all agents in parallel (single message, multiple Task calls).
</step>

<step name="synthesize_consensus">
Tally votes per gray area. Majority wins (odd number = no ties).

**For each gray area:**

1. Collect all agent recommendations
2. Group similar recommendations (agents may phrase differently but mean the same thing)
3. Count votes for each distinct position
4. **Majority (>50%)** → Locked Decision
5. **Plurality but no majority** → Claude's Discretion (note the split)
6. **Any agent flags scope creep** → Deferred Idea

**Build the decision summary:**

```
Gray Area: Session Handling
- JWT with 15min access + 7d refresh (3 votes: Engineer, Product, QA)
- JWT with 1hr access + 30d refresh (2 votes: UX, Devil's Advocate)
→ DECISION: JWT with 15min access + 7d refresh (consensus)
→ RATIONALE: Security-performance balance, standard practice

Gray Area: Error Responses
- Specific error codes with user-friendly messages (2 votes)
- Generic errors in production, specific in dev (2 votes)
- Specific everywhere with rate limit headers (1 vote)
→ DISCRETION: Split between specific and environment-based. Note: majority favors specific errors.
```
</step>

<step name="write_context">
Create CONTEXT.md in the same format as discuss-phase output.

**Find or create phase directory:**

Use values from init: `phase_dir`, `phase_slug`, `padded_phase`.

If `phase_dir` is null:
```bash
mkdir -p ".planning/phases/${padded_phase}-${phase_slug}"
```

**File location:** `${phase_dir}/${padded_phase}-CONTEXT.md`

```markdown
# Phase [X]: [Name] - Context

**Generated:** [date]
**Method:** Synthetic discuss (${AGENT_COUNT} agents)
**Status:** Ready for planning

<domain>
## Phase Boundary

[Clear statement of what this phase delivers — from ROADMAP.md goal]

</domain>

<decisions>
## Implementation Decisions

### [Gray Area 1]
- **Decision:** [consensus recommendation]
- **Rationale:** [combined justification from voting agents]
- **Consensus:** [N]/[AGENT_COUNT] agents agreed

### [Gray Area 2]
- **Decision:** [consensus recommendation]
- **Rationale:** [combined justification]
- **Consensus:** [N]/[AGENT_COUNT] agents agreed

### Claude's Discretion
[Areas where votes were split — note both positions and let planner decide]
- [Gray Area X]: Split between [option A] and [option B]. [Brief context on tradeoffs.]

</decisions>

<specifics>
## Specific Ideas

[Notable recommendations from individual agents worth preserving — e.g., a QA agent flagging an important edge case, or a UX agent suggesting a specific interaction pattern]

</specifics>

<deferred>
## Deferred Ideas

[Any scope creep flagged by agents — captured for future phases]

[If none: "None — all recommendations stayed within phase scope"]

</deferred>

---

*Phase: ${padded_phase}-${phase_slug}*
*Context generated: [date] via synthetic discuss*
```
</step>

<step name="commit_and_return">
Commit the generated context:

```bash
node ~/.claude/get-shit-done/bin/gsd-tools.cjs commit "docs(${padded_phase}): generate synthetic phase context" --files "${phase_dir}/${padded_phase}-CONTEXT.md"
```

Update STATE.md:
```bash
node ~/.claude/get-shit-done/bin/gsd-tools.cjs state record-session \
  --stopped-at "Phase ${PHASE} synthetic context generated" \
  --resume-file "${phase_dir}/${padded_phase}-CONTEXT.md"
```

Return status to caller:
```
## CONTEXT GENERATED

Phase: ${PHASE_NUMBER} - ${PHASE_NAME}
Method: Synthetic discuss (${AGENT_COUNT} agents)
Decisions: [N] locked, [M] discretion, [K] deferred
File: ${phase_dir}/${padded_phase}-CONTEXT.md
```
</step>

</process>

<success_criteria>
- [ ] Phase validated against roadmap
- [ ] Gray areas identified through domain analysis (not generic)
- [ ] Correct number of agents spawned (from config)
- [ ] Each agent assigned distinct perspective
- [ ] Majority consensus calculated per gray area
- [ ] CONTEXT.md matches discuss-phase output format
- [ ] Split votes noted as Claude's Discretion (not arbitrary picks)
- [ ] Scope creep flagged as Deferred Ideas
- [ ] Previous phase decisions considered for consistency
- [ ] File committed and state updated
</success_criteria>
