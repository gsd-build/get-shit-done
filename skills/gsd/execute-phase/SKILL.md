---
name: execute-phase
description: Execute all plans in a phase with wave-based parallelization
license: MIT
metadata:
  author: get-shit-done
  version: "1.0"
  category: project-management
allowed-tools: 
---

# execute-phase Skill

## Objective

Execute all plans in a phase using wave-based parallel execution.
Orchestrator stays lean: discover plans, analyze dependencies, group into waves, spawn subagents, collect results. Each subagent loads the full execute-plan context and handles its own plan.
Context budget: ~15% orchestrator, 100% fresh per subagent.
@~/.claude/get-shit-done/workflows/execute-phase.md
@~/.claude/get-shit-done/templates/subagent-task-prompt.md

## When to Use



## Process

1. **Validate phase exists**
   - Find phase directory matching argument
   - Count PLAN.md files
   - Error if no plans found
2. **Discover plans**
   - List all *-PLAN.md files in phase directory
   - Check which have *-SUMMARY.md (already complete)
   - Build list of incomplete plans
3. **Group by wave**
   - Read `wave` from each plan's frontmatter
   - Group plans by wave number
   - Report wave structure to user
4. **Execute waves**
   For each wave in order:
   - Fill subagent-task-prompt template for each plan
   - Spawn all agents in wave simultaneously (parallel Task calls)
   - Wait for completion (Task blocks)
   - Verify SUMMARYs created
   - Proceed to next wave
5. **Aggregate results**
   - Collect summaries from all plans
   - Report phase completion status
   - Update ROADMAP.md
6. **Offer next steps**
   - More phases → `/gsd:plan-phase {next}`
   - Milestone complete → `/gsd:complete-milestone`
**Parallel spawning:**
Spawn all plans in a wave with a single message containing multiple Task calls:
```
Task(prompt=filled_template_for_plan_01, subagent_type="general-purpose")
Task(prompt=filled_template_for_plan_02, subagent_type="general-purpose")
Task(prompt=filled_template_for_plan_03, subagent_type="general-purpose")
```
All three run in parallel. Task tool blocks until all complete.
**No polling.** No background agents. No TaskOutput loops.

## Success Criteria

- [ ] All incomplete plans in phase executed
- [ ] Each plan has SUMMARY.md
- [ ] STATE.md reflects phase completion
- [ ] ROADMAP.md updated
- [ ] User informed of next steps

## Anti-Patterns



## Examples

### Example Usage
\[TBD: Add specific examples of when and how to use this skill\]

## Error Handling

- If required files are missing: Display clear error messages with setup instructions
- If arguments are invalid: Show usage examples and exit gracefully
- If operations fail: Provide detailed error information and suggest remedies
