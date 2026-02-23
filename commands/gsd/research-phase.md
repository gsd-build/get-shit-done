---
name: gsd:research-phase
description: Research how to implement a phase (standalone - usually use /gsd:plan-phase instead)
argument-hint: "[phase]"
allowed-tools:
  - Read
  - Bash
  - Task
---

<objective>
Research how to implement a phase. Spawns gsd-phase-researcher agent with phase context.

**Note:** This is a standalone research command. For most workflows, use `/gsd:plan-phase` which integrates research automatically.

**Use this command when:**
- You want to research without planning yet
- You want to re-research after planning is complete
- You need to investigate before deciding if a phase is feasible

**Orchestrator role:** Parse phase, validate against roadmap, check existing research, gather context, spawn researcher agent, present results.

**Why subagent:** Research burns context fast (WebSearch, Context7 queries, source verification). Fresh 200k context for investigation. Main context stays lean for user interaction.
</objective>

<context>
Phase number: $ARGUMENTS (required)

Normalize phase input in step 1 before any directory lookups.
</context>

<process>

## 0. Initialize Context

```bash
INIT=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs init phase-op "$ARGUMENTS")
```

Extract from init JSON: `phase_dir`, `phase_number`, `phase_name`, `phase_found`, `commit_docs`, `has_research`, `state_path`, `requirements_path`, `context_path`, `research_path`.

Resolve researcher model:
```bash
RESEARCHER_MODEL=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs resolve-model gsd-phase-researcher --raw)
```

## 1. Validate Phase

```bash
PHASE_INFO=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs roadmap get-phase "${phase_number}")
```

**If `found` is false:** Error and exit. **If `found` is true:** Extract `phase_number`, `phase_name`, `goal` from JSON.

## 2. Check Existing Research

```bash
ls .planning/phases/${PHASE}-*/RESEARCH.md 2>/dev/null
```

**If exists:** Offer: 1) Update research, 2) View existing, 3) Skip. Wait for response.

**If doesn't exist:** Continue.

## 3. Gather Phase Context

Use paths from INIT (do not inline file contents in orchestrator context):
- `requirements_path`
- `context_path`
- `state_path`

Present summary with phase description and what files the researcher will load.

## 4. Spawn gsd-phase-researcher Agent

Research modes: ecosystem (default), feasibility, implementation, comparison.

```markdown
<research_type>
Phase Research — investigating HOW to implement a specific phase well.
</research_type>

<key_insight>
The question is NOT "which library should I use?"

The question is: "What do I not know that I don't know?"

For this phase, discover:
- What's the established architecture pattern?
- What libraries form the standard stack?
- What problems do people commonly hit?
- What's SOTA vs what Claude's training thinks is SOTA?
- What should NOT be hand-rolled?
</key_insight>

<objective>
Research implementation approach for Phase {phase_number}: {phase_name}
Mode: ecosystem
</objective>

<files_to_read>
- {requirements_path} (Requirements)
- {context_path} (Phase context from discuss-phase, if exists)
- {state_path} (Prior project decisions and blockers)
</files_to_read>

<additional_context>
**Phase description:** {phase_description}
</additional_context>

<downstream_consumer>
Your RESEARCH.md will be loaded by `/gsd:plan-phase` which uses specific sections:
- `## Standard Stack` → Plans use these libraries
- `## Architecture Patterns` → Task structure follows these
- `## Don't Hand-Roll` → Tasks NEVER build custom solutions for listed problems
- `## Common Pitfalls` → Verification steps check for these
- `## Code Examples` → Task actions reference these patterns

Be prescriptive, not exploratory. "Use X" not "Consider X or Y."
</downstream_consumer>

<quality_gate>
Before declaring complete, verify:
- [ ] All domains investigated (not just some)
- [ ] Negative claims verified with official docs
- [ ] Multiple sources for critical claims
- [ ] Confidence levels assigned honestly
- [ ] Section names match what plan-phase expects
</quality_gate>

<output>
Write to: .planning/phases/${PHASE}-{slug}/${PHASE}-RESEARCH.md
</output>
```

```
Task(
  prompt="First, read ~/.claude/agents/gsd-phase-researcher.md for your role and instructions.\n\n" + filled_prompt,
  subagent_type="general-purpose",
  model="{researcher_model}",
  description="Research Phase {phase}"
)
```

## 5. Handle Agent Return

**`## RESEARCH COMPLETE`:** Display summary, offer: Plan phase, Dig deeper, Review full, Done.

**`## CHECKPOINT REACHED`:** Present to user, get response, spawn continuation.

**`## RESEARCH INCONCLUSIVE`:** Show what was attempted, offer: Add context, Try different mode, Manual.

## 6. Spawn Continuation Agent

```markdown
<objective>
Continue research for Phase {phase_number}: {phase_name}
</objective>

<prior_state>
<files_to_read>
- .planning/phases/${PHASE}-{slug}/${PHASE}-RESEARCH.md (Existing research)
</files_to_read>
</prior_state>

<checkpoint_response>
**Type:** {checkpoint_type}
**Response:** {user_response}
</checkpoint_response>
```

```
Task(
  prompt="First, read ~/.claude/agents/gsd-phase-researcher.md for your role and instructions.\n\n" + continuation_prompt,
  subagent_type="general-purpose",
  model="{researcher_model}",
  description="Continue research Phase {phase}"
)
```

</process>

<success_criteria>
- [ ] Phase validated against roadmap
- [ ] Existing research checked
- [ ] gsd-phase-researcher spawned with context
- [ ] Checkpoints handled correctly
- [ ] User knows next steps
</success_criteria>
