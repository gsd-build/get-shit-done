---
description: Research how to implement a phase before planning
argument-hint: "[phase]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - Task
  - TodoWrite
  - WebFetch
  - WebSearch
  - mcp__context7__*
---

<objective>
Comprehensive research on HOW to implement a phase before planning.

For niche/complex domains where Claude's training data is sparse or outdated. Discovers libraries, architecture patterns, standard stacks, common pitfalls.

Output: RESEARCH.md with ecosystem knowledge that informs quality planning.
</objective>

<context>
Phase number: $ARGUMENTS (required)

**Load minimal state for orchestration:**
@.planning/STATE.md
</context>

<when_to_use>
**Use research-phase for:**
- 3D graphics, game dev, audio/music, shaders, ML/AI
- Real-time systems, specialized frameworks
- Any domain where "how do experts do this" matters

**Skip for:** Standard web dev, well-known patterns, simple integrations
</when_to_use>

<delegate_execution>
**IMPORTANT: Delegate to sub-agent for context efficiency.**

**Step 1: Validate phase argument**
```bash
[ -z "$ARGUMENTS" ] && { echo "ERROR: Phase number required. Usage: /gsd:research-phase [phase]"; exit 1; }
[ -d .planning ] || { echo "ERROR: No .planning/ directory. Run /gsd:new-project first."; exit 1; }
```

**Step 2: Delegate research to sub-agent**

Use Task tool with subagent_type="general-purpose":

```
Research phase: [PHASE_NUMBER]

**Read and follow the workflow:**
~/.claude/get-shit-done/workflows/research-phase.md

**Reference files:**
- ~/.claude/get-shit-done/templates/research.md (RESEARCH.md structure)
- ~/.claude/get-shit-done/references/research-pitfalls.md (what to avoid)

**Project context to read:**
- .planning/ROADMAP.md (phase description and goals)
- .planning/PROJECT.md (project constraints)
- .planning/STATE.md (accumulated decisions)
- .planning/phases/XX-name/*-CONTEXT.md (if exists)

**Your task:**
1. Identify the phase in ROADMAP.md
2. Analyze phase to identify knowledge gaps
3. Determine research domains (architecture, ecosystem, patterns, pitfalls)
4. Execute comprehensive research (Context7, official docs, WebSearch)
5. Cross-verify all findings
6. Create RESEARCH.md with actionable ecosystem knowledge

**Return to parent:**
- Research domains covered
- Key libraries/tools identified
- Architecture patterns found
- Major pitfalls catalogued
- RESEARCH.md path
- Suggested next command (/gsd:plan-phase [N])
```

</delegate_execution>

<success_criteria>
- Phase validated against roadmap
- Comprehensive research executed
- RESEARCH.md created with ecosystem knowledge
- User knows next steps (plan phase)
</success_criteria>
